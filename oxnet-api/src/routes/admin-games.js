import {
  requireAdmin
} from '../lib/admin.js'

import {
  jsonResponse
} from '../lib/http.js'


export async function handleAdminGameRoutes (context) {
  const {
    request,
    url,
    sql,
    headers
  } = context

  if (!url.pathname.startsWith('/admin/games')) {
    return null
  }

  const admin =
    await requireAdmin(context)

  if (admin.response) {
    return admin.response
  }


  /*
    ================================================
    LIST ACTIVE GAME QUEUE
    GET /admin/games
    ================================================
  */

  if (
    url.pathname === '/admin/games' &&
    request.method === 'GET'
  ) {
    try {
      const rows =
        await sql`
          select
            id,
            twitch_login,
            twitch_display_name,
            game_name,
            priority,
            status,
            requested_at,
            started_at
          from game_requests
          where status in (
            'queued',
            'playing'
          )
          order by
            case
              when status = 'playing'
                then 0
              else 1
            end,
            priority desc,
            requested_at asc
        `

      return jsonResponse(
        {
          success: true,

          games:
            rows.map(
              (row, index) => ({
                id:
                  Number(row.id),

                position:
                  index + 1,

                requested_by:
                  row.twitch_display_name ||
                  row.twitch_login,

                game_name:
                  row.game_name,

                priority:
                  Number(row.priority),

                status:
                  row.status,

                requested_at:
                  row.requested_at,

                started_at:
                  row.started_at
              })
            )
        },
        200,
        headers
      )
    } catch (error) {
      console.error(
        'Admin game list failed:',
        error
      )

      return jsonResponse(
        {
          error:
            'Game queue lookup failed'
        },
        500,
        headers
      )
    }
  }


  /*
    ================================================
    MANUALLY ADD GAME
    POST /admin/games/add
    ================================================
  */

  if (
    url.pathname === '/admin/games/add' &&
    request.method === 'POST'
  ) {
    try {
      const body =
        await request.json()

      const gameName =
        String(
          body.game_name || ''
        ).trim()

      if (!gameName) {
        return jsonResponse(
          {
            error:
              'Game name is required'
          },
          400,
          headers
        )
      }

      if (gameName.length > 120) {
        return jsonResponse(
          {
            error:
              'Game name is too long'
          },
          400,
          headers
        )
      }

      const existing =
        await sql`
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
            error:
              'Game is already active',
            request_id:
              Number(existing[0].id),
            game_name:
              existing[0].game_name
          },
          409,
          headers
        )
      }

      const syntheticUserId =
        `admin:${crypto.randomUUID()}`

      const rows =
        await sql`
          insert into game_requests (
            twitch_user_id,
            twitch_login,
            twitch_display_name,
            game_name,
            priority,
            status
          )
          values (
            ${syntheticUserId},
            'oxnet_admin',
            'OXNET ADMIN',
            ${gameName},
            0,
            'queued'
          )
          returning
            id,
            game_name,
            status,
            requested_at
        `

      return jsonResponse(
        {
          success: true,
          request_id:
            Number(rows[0].id),
          game_name:
            rows[0].game_name,
          status:
            rows[0].status,
          requested_at:
            rows[0].requested_at
        },
        201,
        headers
      )
    } catch (error) {
      console.error(
        'Admin add game failed:',
        error
      )

      return jsonResponse(
        {
          error:
            'Unable to add game'
        },
        500,
        headers
      )
    }
  }


  /*
    ================================================
    UPDATE GAME STATUS

    POST /admin/games/status

    {
      "request_id": 12,
      "status": "playing"
    }
    ================================================
  */

  if (
    url.pathname === '/admin/games/status' &&
    request.method === 'POST'
  ) {
    try {
      const body =
        await request.json()

      const requestId =
        Number(
          body.request_id
        )

      const newStatus =
        String(
          body.status || ''
        ).toLowerCase()

      const allowedStatuses = [
        'playing',
        'completed',
        'removed',
        'rejected'
      ]

      if (
        !Number.isInteger(requestId) ||
        requestId <= 0
      ) {
        return jsonResponse(
          {
            error:
              'Invalid request ID'
          },
          400,
          headers
        )
      }

      if (
        !allowedStatuses.includes(
          newStatus
        )
      ) {
        return jsonResponse(
          {
            error:
              'Invalid game status'
          },
          400,
          headers
        )
      }


      /*
        PLAYING

        Only one game may be marked
        playing at a time.
      */

      if (newStatus === 'playing') {
        const currentPlaying =
          await sql`
            select
              id,
              game_name
            from game_requests
            where status = 'playing'
            limit 1
          `

        if (
          currentPlaying.length > 0 &&
          Number(
            currentPlaying[0].id
          ) !== requestId
        ) {
          return jsonResponse(
            {
              error:
                'Another game is already playing',

              request_id:
                Number(
                  currentPlaying[0].id
                ),

              game_name:
                currentPlaying[0].game_name
            },
            409,
            headers
          )
        }

        const rows =
          await sql`
            update game_requests
            set
              status = 'playing',
              started_at =
                coalesce(
                  started_at,
                  now()
                )
            where
              id = ${requestId}
              and status in (
                'queued',
                'playing'
              )
            returning
              id,
              game_name,
              status
          `

        if (!rows.length) {
          return jsonResponse(
            {
              error:
                'Game request is not active'
            },
            409,
            headers
          )
        }

        return jsonResponse(
          {
            success: true,
            request_id:
              Number(rows[0].id),
            game_name:
              rows[0].game_name,
            status:
              rows[0].status
          },
          200,
          headers
        )
      }


      /*
        COMPLETE / REMOVE / REJECT
      */

      let rows

      if (
        newStatus === 'completed'
      ) {
        rows =
          await sql`
            update game_requests
            set
              status = 'completed',
              completed_at = now()
            where
              id = ${requestId}
              and status in (
                'queued',
                'playing'
              )
            returning
              id,
              game_name,
              status
          `
      } else {
        rows =
          await sql`
            update game_requests
            set
              status = ${newStatus}
            where
              id = ${requestId}
              and status in (
                'queued',
                'playing'
              )
            returning
              id,
              game_name,
              status
          `
      }

      if (!rows.length) {
        return jsonResponse(
          {
            error:
              'Game request is not active'
          },
          409,
          headers
        )
      }

      return jsonResponse(
        {
          success: true,
          request_id:
            Number(rows[0].id),
          game_name:
            rows[0].game_name,
          status:
            rows[0].status
        },
        200,
        headers
      )

    } catch (error) {
      console.error(
        'Admin game status failed:',
        error
      )

      return jsonResponse(
        {
          error:
            'Unable to update game'
        },
        500,
        headers
      )
    }
  }


  return jsonResponse(
    {
      error:
        'Admin game route not found'
    },
    404,
    headers
  )
}