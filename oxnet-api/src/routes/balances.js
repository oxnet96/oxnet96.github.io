import { isBridgeAuthorized, jsonResponse } from '../lib/http.js'

export async function handleBalanceRoutes (context) {
  const { request, env, url, sql, headers } = context

  if (url.pathname === '/bridge/sync-balance') {
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
      const schmeckles = Number(body.schmeckles)

      if (
        !twitchUserId ||
        !twitchLogin ||
        !Number.isInteger(schmeckles) ||
        schmeckles < 0
      ) {
        return jsonResponse({ error: 'Invalid sync payload' }, 400, headers)
      }

      const users = await sql`
        insert into users (
          twitch_user_id,
          twitch_login,
          twitch_display_name,
          last_seen_at
        )
        values (
          ${twitchUserId},
          ${twitchLogin},
          ${twitchDisplayName},
          now()
        )
        on conflict (twitch_user_id)
        do update set
          twitch_login = excluded.twitch_login,
          twitch_display_name = excluded.twitch_display_name,
          last_seen_at = now()
        returning id
      `

      const userId = users[0].id

      await sql`
        insert into balances (
          user_id,
          schmeckles,
          synced_at
        )
        values (
          ${userId},
          ${schmeckles},
          now()
        )
        on conflict (user_id)
        do update set
          schmeckles = excluded.schmeckles,
          synced_at = now()
      `

      return jsonResponse(
        {
          success: true,
          twitch_user_id: twitchUserId,
          twitch_login: twitchLogin,
          schmeckles
        },
        200,
        headers
      )
    } catch (error) {
      console.error('Bridge balance sync failed:', error)
      return jsonResponse({ error: 'Balance sync failed' }, 500, headers)
    }
  }

  if (url.pathname === '/balance') {
    try {
      const rows = await sql`
        select
          u.twitch_login,
          u.twitch_display_name,
          b.schmeckles,
          b.synced_at
        from users u
        join balances b
          on b.user_id = u.id
        where u.twitch_user_id = 'dev_ox_king'
        limit 1
      `

      if (!rows.length) {
        return jsonResponse({ error: 'User not found' }, 404, headers)
      }

      return jsonResponse(
        {
          user: rows[0].twitch_display_name,
          login: rows[0].twitch_login,
          schmeckles: Number(rows[0].schmeckles),
          synced_at: rows[0].synced_at
        },
        200,
        headers
      )
    } catch (error) {
      console.error(error)
      return jsonResponse(
        { error: 'Database connection failed' },
        500,
        headers
      )
    }
  }

  return null
}
