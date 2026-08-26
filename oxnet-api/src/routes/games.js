import { isBridgeAuthorized, jsonResponse } from '../lib/http.js'

export async function handleGameRoutes (context) {
  const { request, env, url, sql, headers } = context

  if (url.pathname !== '/bridge/game-request') {
    return null
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405, headers)
  }

  if (!isBridgeAuthorized(request, env)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, headers)
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
      return jsonResponse({ error: 'Missing required fields' }, 400, headers)
    }

    if (gameName.length > 120) {
      return jsonResponse({ error: 'Game name is too long' }, 400, headers)
    }

    const userActiveRequest = await sql`
      select
        id,
        game_name,
        status
      from game_requests
      where
        twitch_user_id = ${twitchUserId}
        and status in ('queued', 'playing')
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

    const existing = await sql`
      select
        id,
        game_name
      from game_requests
      where
        lower(game_name) = lower(${gameName})
        and status in ('queued', 'playing')
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
    return jsonResponse({ error: 'Game request failed' }, 500, headers)
  }
}
