import { isBridgeAuthorized, jsonResponse } from '../lib/http.js'

export async function handleGameRoutes (context) {
  const { request, env, url, sql, headers } = context

  /*
    ==================================================
    PUBLIC GAME QUEUE
    ==================================================
  */

  if (url.pathname === '/game-queue') {
    try {
      const rows = await sql`
          select
            id,
            twitch_login,
            twitch_display_name,
            game_name,
            priority,
            status,
            requested_at
          from game_requests
          where status in (
            'queued',
            'playing'
          )
          order by
            case
              when status = 'playing' then 0
              else 1
            end,
            priority desc,
            requested_at asc
        `

      return jsonResponse(
        {
          games: rows.map((row, index) => ({
            id: Number(row.id),

            position: index + 1,

            requested_by: row.twitch_display_name || row.twitch_login,

            game_name: row.game_name,

            priority: Number(row.priority),

            status: row.status,

            requested_at: row.requested_at
          }))
        },
        200,
        headers
      )
    } catch (error) {
      console.error('Game queue failed:', error)

      return jsonResponse(
        {
          error: 'Game queue unavailable'
        },
        500,
        headers
      )
    }
  }

  /*
  ==================================================
  JUMP GAME TO FRONT
  ==================================================
*/

  if (url.pathname === '/bridge/game-jump') {
    if (request.method !== 'POST') {
      return jsonResponse(
        {
          error: 'Method not allowed'
        },
        405,
        headers
      )
    }

    if (!isBridgeAuthorized(request, env)) {
      return jsonResponse(
        {
          error: 'Unauthorized'
        },
        401,
        headers
      )
    }

    try {
      const body = await request.json()

      const requestId = Number(body.request_id)

      if (!Number.isInteger(requestId) || requestId <= 0) {
        return jsonResponse(
          {
            error: 'Invalid request ID'
          },
          400,
          headers
        )
      }

      const target = await sql`
        select
          id,
          game_name,
          status,
          priority
        from game_requests
        where id = ${requestId}
        limit 1
      `

      if (!target.length) {
        return jsonResponse(
          {
            error: 'Game request not found'
          },
          404,
          headers
        )
      }

      if (target[0].status !== 'queued') {
        return jsonResponse(
          {
            error: 'Game request is not queued',
            request_id: Number(target[0].id),
            game_name: target[0].game_name,
            status: target[0].status
          },
          409,
          headers
        )
      }

      const firstQueued = await sql`
    select id
    from game_requests
    where status = 'queued'
    order by
      priority desc,
      requested_at asc
    limit 1
  `

      if (firstQueued.length > 0 && Number(firstQueued[0].id) === requestId) {
        return jsonResponse(
          {
            error: 'Game request is already first in queue',
            request_id: Number(target[0].id),
            game_name: target[0].game_name,
            status: target[0].status
          },
          409,
          headers
        )
      }

      const priorityRows = await sql`
        select
          coalesce(
            max(priority),
            0
          ) as max_priority
        from game_requests
        where status = 'queued'
      `

      const nextPriority = Number(priorityRows[0].max_priority) + 1

      const updated = await sql`
        update game_requests
        set priority =
          ${nextPriority}
        where id =
          ${requestId}
        returning
          id,
          game_name,
          priority
      `

      return jsonResponse(
        {
          success: true,
          request_id: Number(updated[0].id),
          game_name: updated[0].game_name,
          priority: Number(updated[0].priority)
        },
        200,
        headers
      )
    } catch (error) {
      console.error('Game jump failed:', error)

      return jsonResponse(
        {
          error: 'Game jump failed'
        },
        500,
        headers
      )
    }
  }

  /*
    ==================================================
    ADD GAME REQUEST
    ==================================================
  */

  if (url.pathname !== '/bridge/game-request') {
    return null
  }

  if (request.method !== 'POST') {
    return jsonResponse(
      {
        error: 'Method not allowed'
      },
      405,
      headers
    )
  }

  if (!isBridgeAuthorized(request, env)) {
    return jsonResponse(
      {
        error: 'Unauthorized'
      },
      401,
      headers
    )
  }

  try {
    const body = await request.json()

    const twitchUserId = String(body.twitch_user_id || '').trim()

    const twitchLogin = String(body.twitch_login || '').trim()

    const twitchDisplayName = String(
      body.twitch_display_name || twitchLogin
    ).trim()

    const gameName = String(body.game_name || '').trim()

    if (!twitchUserId || !twitchLogin || !gameName) {
      return jsonResponse(
        {
          error: 'Missing required fields'
        },
        400,
        headers
      )
    }

    if (gameName.length > 120) {
      return jsonResponse(
        {
          error: 'Game name is too long'
        },
        400,
        headers
      )
    }

    /*
      One active game request
      per viewer.
    */

    const userActiveRequest = await sql`
        select
          id,
          game_name,
          status
        from game_requests
        where
          twitch_user_id =
            ${twitchUserId}
          and status in (
            'queued',
            'playing'
          )
        order by requested_at asc
        limit 1
      `

    if (userActiveRequest.length > 0) {
      return jsonResponse(
        {
          error: 'User already has an active game request',

          request_id: Number(userActiveRequest[0].id),

          game_name: userActiveRequest[0].game_name,

          status: userActiveRequest[0].status
        },
        409,
        headers
      )
    }

    /*
      Do not allow the same game
      to be active twice.
    */

    const existing = await sql`
        select
          id,
          game_name
        from game_requests
        where
          lower(game_name) =
            lower(${gameName})
          and status in (
            'queued',
            'playing'
          )
        limit 1
      `

    if (existing.length > 0) {
      return jsonResponse(
        {
          error: 'Game is already in the queue',

          request_id: Number(existing[0].id),

          game_name: existing[0].game_name
        },
        409,
        headers
      )
    }

    const rows = await sql`
        insert into game_requests (
          twitch_user_id,
          twitch_login,
          twitch_display_name,
          game_name,
          priority,
          status
        )
        values (
          ${twitchUserId},
          ${twitchLogin},
          ${twitchDisplayName},
          ${gameName},
          0,
          'queued'
        )
        returning
          id,
          game_name,
          requested_at
      `

    return jsonResponse(
      {
        success: true,

        request_id: Number(rows[0].id),

        game_name: rows[0].game_name,

        requested_at: rows[0].requested_at
      },
      201,
      headers
    )
  } catch (error) {
    console.error('Game request failed:', error)

    return jsonResponse(
      {
        error: 'Game request failed'
      },
      500,
      headers
    )
  }
}
