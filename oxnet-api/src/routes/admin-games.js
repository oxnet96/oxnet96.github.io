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

  if (
    !url.pathname.startsWith(
      '/admin/games'
    )
  ) {
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
            request_code,
            game_library_id,
            twitch_login,
            twitch_display_name,
            game_name,
            platform,
            cost_paid,
            refund_status,
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
                /*
                  "id" is kept for frontend
                  compatibility, but it is now
                  the PUBLIC request code.
                */

                id:
                  Number(
                    row.request_code
                  ),

                request_code:
                  Number(
                    row.request_code
                  ),

                position:
                  index + 1,

                game_library_id:
                  row.game_library_id
                    ? Number(
                        row.game_library_id
                      )
                    : null,

                requested_by:
                  row.twitch_display_name ||
                  row.twitch_login,

                game_name:
                  row.game_name,

                platform:
                  row.platform,

                cost_paid:
                  Number(
                    row.cost_paid || 0
                  ),

                refund_status:
                  row.refund_status,

                priority:
                  Number(
                    row.priority
                  ),

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
    MANUALLY ADD LIBRARY GAME

    POST /admin/games/add

    {
      "library_code": "G4821"
    }

    Admin-added games:
    - must exist in game_library
    - are linked to the library
    - cost 0 Schmeckles
    - receive a normal 5-digit Request ID
    ================================================
  */

  if (
    url.pathname === '/admin/games/add' &&
    request.method === 'POST'
  ) {
    try {
      const body =
        await request.json()

      const libraryCode =
        String(
          body.library_code || ''
        )
          .trim()
          .toUpperCase()

      if (!libraryCode) {
        return jsonResponse(
          {
            error:
              'Library code is required'
          },
          400,
          headers
        )
      }


      /*
        Resolve the canonical library game.
      */

      const libraryRows =
        await sql`
          select
            id,
            library_code,
            game_name,
            platform,
            owned,
            enabled,
            completed_at
          from game_library
          where
            upper(library_code) =
              ${libraryCode}
          limit 1
        `

      if (!libraryRows.length) {
        return jsonResponse(
          {
            error:
              'Library code not found'
          },
          404,
          headers
        )
      }

      const game =
        libraryRows[0]


      /*
        Avoid accidental replays from the
        normal manual-add button.

        We can build an explicit admin
        override later if desired.
      */

      if (game.completed_at) {
        return jsonResponse(
          {
            error:
              'Game has already been completed',

            library_code:
              game.library_code,

            game_name:
              game.game_name,

            platform:
              game.platform
          },
          409,
          headers
        )
      }


      /*
        Same exact library game cannot
        already be queued/playing.
      */

      const existing =
        await sql`
          select
            request_code,
            game_name,
            platform
          from game_requests
          where
            game_library_id =
              ${game.id}
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
              Number(
                existing[0]
                  .request_code
              ),

            game_name:
              existing[0]
                .game_name,

            platform:
              existing[0]
                .platform
          },
          409,
          headers
        )
      }


      /*
        Synthetic admin requester.

        A unique Twitch user ID prevents
        the one-active-request-per-viewer
        constraint from blocking other
        admin queue additions.
      */

      const syntheticUserId =
        `admin:${crypto.randomUUID()}`


      /*
        request_code is generated by Neon.
        cost_paid = 0 because this did not
        originate from a viewer purchase.
      */

      const rows =
        await sql`
          insert into game_requests (
            twitch_user_id,
            twitch_login,
            twitch_display_name,
            game_library_id,
            game_name,
            platform,
            cost_paid,
            priority,
            status
          )
          values (
            ${syntheticUserId},
            'oxnet_admin',
            'OXNET ADMIN',
            ${game.id},
            ${game.game_name},
            ${game.platform},
            0,
            0,
            'queued'
          )
          returning
            request_code,
            game_library_id,
            game_name,
            platform,
            cost_paid,
            status,
            requested_at
        `

      return jsonResponse(
        {
          success: true,

          request_id:
            Number(
              rows[0]
                .request_code
            ),

          request_code:
            Number(
              rows[0]
                .request_code
            ),

          game_library_id:
            Number(
              rows[0]
                .game_library_id
            ),

          game_name:
            rows[0].game_name,

          platform:
            rows[0].platform,

          cost_paid:
            Number(
              rows[0].cost_paid
            ),

          status:
            rows[0].status,

          requested_at:
            rows[0]
              .requested_at
        },
        201,
        headers
      )

    } catch (error) {
      console.error(
        'Admin add game failed:',
        error
      )

      if (
        error &&
        error.code === '23505'
      ) {
        return jsonResponse(
          {
            error:
              'Game conflicts with an active request'
          },
          409,
          headers
        )
      }

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
      "request_id": 48317,
      "status": "playing"
    }

    request_id is ALWAYS the public
    5-digit Request ID.
    ================================================
  */

  if (
    url.pathname ===
      '/admin/games/status' &&
    request.method === 'POST'
  ) {
    try {
      const body =
        await request.json()

      const requestCode =
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


      /*
        Public Request IDs are always
        five digits.
      */

      if (
        !Number.isInteger(
          requestCode
        ) ||
        requestCode < 10000 ||
        requestCode > 99999
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
        Resolve the public Request ID
        to our private database primary key.
      */

      const target =
        await sql`
          select
            id,
            request_code,
            game_name,
            platform,
            status
          from game_requests
          where
            request_code =
              ${requestCode}
          limit 1
        `

      if (!target.length) {
        return jsonResponse(
          {
            error:
              'Game request not found'
          },
          404,
          headers
        )
      }

      const internalId =
        Number(
          target[0].id
        )


      /*
        ==============================================
        PLAY

        Only one game may be marked
        PLAYING at a time.
        ==============================================
      */

      if (
        newStatus === 'playing'
      ) {
        const currentPlaying =
          await sql`
            select
              id,
              request_code,
              game_name,
              platform
            from game_requests
            where status = 'playing'
            limit 1
          `

        if (
          currentPlaying.length > 0 &&
          Number(
            currentPlaying[0].id
          ) !== internalId
        ) {
          return jsonResponse(
            {
              error:
                'Another game is already playing',

              request_id:
                Number(
                  currentPlaying[0]
                    .request_code
                ),

              game_name:
                currentPlaying[0]
                  .game_name,

              platform:
                currentPlaying[0]
                  .platform
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
              id =
                ${internalId}

              and status in (
                'queued',
                'playing'
              )

            returning
              request_code,
              game_name,
              platform,
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
              Number(
                rows[0]
                  .request_code
              ),

            game_name:
              rows[0].game_name,

            platform:
              rows[0].platform,

            status:
              rows[0].status
          },
          200,
          headers
        )
      }


      /*
        ==============================================
        COMPLETE / REMOVE / REJECT
        ==============================================

        COMPLETE also triggers our Neon
        library completion trigger.

        REJECT triggers the refund queue
        automatically when cost_paid > 0.
      */

      let rows


      if (
        newStatus === 'completed'
      ) {
        rows =
          await sql`
            update game_requests
            set
              status =
                'completed',

              completed_at =
                now()

            where
              id =
                ${internalId}

              and status in (
                'queued',
                'playing'
              )

            returning
              request_code,
              game_name,
              platform,
              cost_paid,
              refund_status,
              status
          `
      } else {
        rows =
          await sql`
            update game_requests
            set
              status =
                ${newStatus}

            where
              id =
                ${internalId}

              and status in (
                'queued',
                'playing'
              )

            returning
              request_code,
              game_name,
              platform,
              cost_paid,
              refund_status,
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
            Number(
              rows[0]
                .request_code
            ),

          game_name:
            rows[0].game_name,

          platform:
            rows[0].platform,

          cost_paid:
            Number(
              rows[0]
                .cost_paid || 0
            ),

          refund_status:
            rows[0]
              .refund_status,

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


  /*
    ================================================
    ADMIN GAME ROUTE NOT FOUND
    ================================================
  */

  return jsonResponse(
    {
      error:
        'Admin game route not found'
    },
    404,
    headers
  )
}