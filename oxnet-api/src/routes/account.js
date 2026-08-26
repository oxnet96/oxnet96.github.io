import { getSession } from '../lib/auth.js'
import { jsonResponse } from '../lib/http.js'

export async function handleAccountRoutes (context) {
  const { request, env, url, sql, headers } = context

  if (url.pathname !== '/me') {
    return null
  }

  try {
    const session = await getSession(request, env)

    if (!session) {
      return jsonResponse({ authenticated: false }, 401, headers)
    }

    const rows = await sql`
      select
        u.twitch_user_id,
        u.twitch_login,
        u.twitch_display_name,
        b.schmeckles,
        b.synced_at
      from users u
      join balances b
        on b.user_id = u.id
      where u.id = ${session.user_id}
      limit 1
    `

    if (!rows.length) {
      return jsonResponse({ authenticated: false }, 404, headers)
    }

    return jsonResponse(
      {
        authenticated: true,
        user: rows[0].twitch_display_name,
        login: rows[0].twitch_login,
        twitch_user_id: rows[0].twitch_user_id,
        schmeckles: Number(rows[0].schmeckles),
        synced_at: rows[0].synced_at
      },
      200,
      headers
    )
  } catch (error) {
    console.error(error)
    return jsonResponse({ error: 'Account lookup failed' }, 500, headers)
  }
}
