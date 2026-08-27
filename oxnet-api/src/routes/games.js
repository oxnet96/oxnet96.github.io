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
          request_code,
          twitch_login,
          twitch_display_name,
          game_name,
          platform,
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
            when status = 'playing'
              then 0
            else 1
          end,
          priority desc,
          requested_at asc
      `

      return jsonResponse(
        {
          games: rows.map((row, index) => ({
            /*
                "id" remains here for
                frontend compatibility,
                but it is now the PUBLIC
                5-digit request code.
              */
            id: Number(row.request_code),

            request_code: Number(row.request_code),

            position: index + 1,

            requested_by: row.twitch_display_name || row.twitch_login,

            game_name: row.game_name,

            platform: row.platform,

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
  LOOK UP GAME IN APPROVED LIBRARY
  ==================================================
*/

if (url.pathname === '/bridge/game-lookup') {
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

    const rows =
      await sql`
        select
          id,
          library_code,
          game_name,
          platform,
          owned,
          enabled,
          request_type,
          schmeckle_cost,
          completed_at
        from game_library
        where
          upper(library_code) =
            ${libraryCode}
        limit 1
      `

    if (!rows.length) {
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
      rows[0]

    if (!game.owned) {
      return jsonResponse(
        {
          error:
            'Game is not currently owned',
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

    if (!game.enabled) {
      return jsonResponse(
        {
          error:
            'Game is currently disabled',
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
            game.platform,
          completed_at:
            game.completed_at
        },
        409,
        headers
      )
    }

    if (
      game.request_type !==
      'schmeckles'
    ) {
      return jsonResponse(
        {
          error:
            'Game is not available for normal Schmeckle requests',
          library_code:
            game.library_code,
          game_name:
            game.game_name,
          platform:
            game.platform,
          request_type:
            game.request_type
        },
        409,
        headers
      )
    }

    return jsonResponse(
      {
        success: true,

        library_id:
          Number(game.id),

        library_code:
          game.library_code,

        game_name:
          game.game_name,

        platform:
          game.platform,

        request_type:
          game.request_type,

        schmeckle_cost:
          Number(
            game.schmeckle_cost
          )
      },
      200,
      headers
    )

  } catch (error) {
    console.error(
      'Game library lookup failed:',
      error
    )

    return jsonResponse(
      {
        error:
          'Game library lookup failed'
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

      /*
      request_id from Streamer.bot
      now means the PUBLIC 5-digit
      request code.
    */

      const requestCode = Number(body.request_id)

      if (
        !Number.isInteger(requestCode) ||
        requestCode < 10000 ||
        requestCode > 99999
      ) {
        return jsonResponse(
          {
            error: 'Invalid request ID'
          },
          400,
          headers
        )
      }

      /*
      Look up by public request code,
      never by database primary key.
    */

      const target = await sql`
        select
          id,
          request_code,
          game_name,
          platform,
          status,
          priority
        from game_requests
        where
          request_code =
            ${requestCode}
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

            request_id: Number(target[0].request_code),

            game_name: target[0].game_name,

            platform: target[0].platform,

            status: target[0].status
          },
          409,
          headers
        )
      }

      /*
      Reject a pointless jump if
      this game is already first.
    */

      const firstQueued = await sql`
        select
          request_code
        from game_requests
        where status = 'queued'
        order by
          priority desc,
          requested_at asc
        limit 1
      `

      if (
        firstQueued.length > 0 &&
        Number(firstQueued[0].request_code) === requestCode
      ) {
        return jsonResponse(
          {
            error: 'Game request is already first in queue',

            request_id: Number(target[0].request_code),

            game_name: target[0].game_name,

            platform: target[0].platform,

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

      /*
      Update using the internal ID
      after resolving the public code.
    */

      const updated = await sql`
        update game_requests
        set
          priority =
            ${nextPriority}
        where
          id =
            ${target[0].id}
        returning
          request_code,
          game_name,
          platform,
          priority
      `

      return jsonResponse(
        {
          success: true,

          request_id: Number(updated[0].request_code),

          request_code: Number(updated[0].request_code),

          game_name: updated[0].game_name,

          platform: updated[0].platform,

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
    const body = await request.json();

    const twitchUserId = String(body.twitch_user_id || "").trim();

    const twitchLogin = String(body.twitch_login || "").trim();

    const twitchDisplayName = String(
      body.twitch_display_name || twitchLogin,
    ).trim();

    const libraryId = Number(body.library_id);
    const expectedCost = Number(body.expected_cost);

    /*
    Required identity fields.
  */

    if (!twitchUserId || !twitchLogin) {
      return jsonResponse(
        {
          error: "Missing Twitch user fields",
        },
        400,
        headers,
      );
    }

    if (!Number.isInteger(libraryId) || libraryId <= 0) {
      return jsonResponse(
        {
          error: "Valid library ID is required",
        },
        400,
        headers,
      );
    }

    if (!Number.isInteger(expectedCost) || expectedCost < 0) {
      return jsonResponse(
        {
          error: "Valid expected cost is required",
        },
        400,
        headers,
      );
    }

    /*
    Re-load the library entry here.

    We do NOT trust the game title,
    platform, eligibility, or cost
    supplied by Streamer.bot.
  */

    const libraryRows = await sql`
      select
        id,
        game_name,
        platform,
        owned,
        enabled,
        request_type,
        schmeckle_cost,
        completed_at
      from game_library
      where id = ${libraryId}
      limit 1
    `;

    if (!libraryRows.length) {
      return jsonResponse(
        {
          error: "Game is not in the approved library",
        },
        404,
        headers,
      );
    }

    const game = libraryRows[0];

    /*
  Make sure the price Streamer.bot
  checked is still the current price.
*/

    const currentCost = Number(game.schmeckle_cost);

    if (currentCost !== expectedCost) {
      return jsonResponse(
        {
          error: "Game price changed. Please try again.",

          game_name: game.game_name,

          platform: game.platform,

          expected_cost: expectedCost,

          current_cost: currentCost,
        },
        409,
        headers,
      );
    }

    /*
    Confirm the game is still eligible
    at the exact moment the request
    is being created.
  */

    if (!game.owned) {
      return jsonResponse(
        {
          error: "Game is not currently owned",
          game_name: game.game_name,
          platform: game.platform,
        },
        409,
        headers,
      );
    }

    if (!game.enabled) {
      return jsonResponse(
        {
          error: "Game is currently disabled",
          game_name: game.game_name,
          platform: game.platform,
        },
        409,
        headers,
      );
    }

    if (game.completed_at) {
      return jsonResponse(
        {
          error: "Game has already been completed",
          game_name: game.game_name,
          platform: game.platform,
          completed_at: game.completed_at,
        },
        409,
        headers,
      );
    }

    if (game.request_type !== "schmeckles") {
      return jsonResponse(
        {
          error: "Game is not available for normal Schmeckle requests",
          game_name: game.game_name,
          platform: game.platform,
          request_type: game.request_type,
        },
        409,
        headers,
      );
    }

    /*
    One active request per viewer.
  */

    const userActiveRequest = await sql`
      select
        id,
        request_code,
        game_name,
        platform,
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
    `;

    if (userActiveRequest.length > 0) {
      return jsonResponse(
        {
          error: "User already has an active game request",

          request_id: userActiveRequest[0].request_code
            ? Number(userActiveRequest[0].request_code)
            : null,

          game_name: userActiveRequest[0].game_name,

          platform: userActiveRequest[0].platform,

          status: userActiveRequest[0].status,
        },
        409,
        headers,
      );
    }

    /*
    One active request for this exact
    game + console library entry.
  */

    const existing = await sql`
      select
        id,
        request_code,
        game_name,
        platform
      from game_requests
      where
        game_library_id =
          ${libraryId}
        and status in (
          'queued',
          'playing'
        )
      limit 1
    `;

    if (existing.length > 0) {
      return jsonResponse(
        {
          error: "Game is already in the queue",

          request_id: existing[0].request_code
            ? Number(existing[0].request_code)
            : null,

          game_name: existing[0].game_name,

          platform: existing[0].platform,
        },
        409,
        headers,
      );
    }

    /*
    Insert canonical library data.

    request_code is generated
    automatically by Neon.
  */

    const rows = await sql`
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
        ${twitchUserId},
        ${twitchLogin},
        ${twitchDisplayName},
        ${libraryId},
        ${game.game_name},
        ${game.platform},
        ${currentCost},
        0,
        'queued'
      )
      returning
        id,
        request_code,
        game_library_id,
        game_name,
        platform,
        cost_paid,
        requested_at
    `;

    return jsonResponse(
      {
        success: true,

        request_id: Number(rows[0].request_code),

        request_code: Number(rows[0].request_code),

        library_id: Number(rows[0].game_library_id),

        game_name: rows[0].game_name,

        platform: rows[0].platform,

        cost_paid: Number(rows[0].cost_paid),

        requested_at: rows[0].requested_at,
      },
      201,
      headers,
    );
  } catch (error) {
    /*
    Database uniqueness protection
    is the final safety net for two
    simultaneous requests.
  */

    if (error && error.code === '23505') {
      return jsonResponse(
        {
          error: 'Game request conflicts with an active request'
        },
        409,
        headers
      )
    }

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
