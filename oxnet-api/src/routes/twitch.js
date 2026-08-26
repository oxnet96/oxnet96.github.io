import { SITE_URL, CALLBACK_URL } from '../config.js'
import { createSignedToken, verifySignedToken, randomHex } from '../lib/auth.js'

export async function handleTwitchRoutes (context) {
  const { env, url, sql } = context

  if (url.pathname === '/auth/twitch') {
    const statePayload = {
      nonce: randomHex(),
      exp: Date.now() + 10 * 60 * 1000
    }

    const state = await createSignedToken(statePayload, env.AUTH_SECRET)

    const params = new URLSearchParams({
      client_id: env.TWITCH_CLIENT_ID,
      redirect_uri: CALLBACK_URL,
      response_type: 'code',
      scope: 'user:read:email',
      state
    })

    return Response.redirect(
      `https://id.twitch.tv/oauth2/authorize?${params.toString()}`,
      302
    )
  }

  if (url.pathname === '/auth/twitch/callback') {
    try {
      const error = url.searchParams.get('error')

      if (error) {
        return Response.redirect(`${SITE_URL}/#auth=denied`, 302)
      }

      const code = url.searchParams.get('code')
      const state = url.searchParams.get('state')

      if (!code || !state) {
        return new Response('Invalid Twitch callback.', { status: 400 })
      }

      const validState = await verifySignedToken(state, env.AUTH_SECRET)

      if (!validState) {
        return new Response('Invalid or expired OAuth state.', { status: 400 })
      }

      const tokenParams = new URLSearchParams({
        client_id: env.TWITCH_CLIENT_ID,
        client_secret: env.TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: CALLBACK_URL
      })

      const tokenResponse = await fetch(
        'https://id.twitch.tv/oauth2/token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: tokenParams.toString()
        }
      )

      if (!tokenResponse.ok) {
        console.error(
          'Twitch token exchange failed',
          await tokenResponse.text()
        )
        throw new Error('Twitch token exchange failed')
      }

      const tokenData = await tokenResponse.json()

      const userResponse = await fetch(
        'https://api.twitch.tv/helix/users',
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
            'Client-Id': env.TWITCH_CLIENT_ID
          }
        }
      )

      if (!userResponse.ok) {
        console.error(
          'Twitch user lookup failed',
          await userResponse.text()
        )
        throw new Error('Twitch user lookup failed')
      }

      const userData = await userResponse.json()
      const twitchUser = userData.data?.[0]

      if (!twitchUser) {
        throw new Error('Twitch user missing')
      }

      const rows = await sql`
        insert into users (
          twitch_user_id,
          twitch_login,
          twitch_display_name,
          last_seen_at
        )
        values (
          ${twitchUser.id},
          ${twitchUser.login},
          ${twitchUser.display_name},
          now()
        )
        on conflict (twitch_user_id)
        do update set
          twitch_login = excluded.twitch_login,
          twitch_display_name = excluded.twitch_display_name,
          last_seen_at = now()
        returning id
      `

      const oxnetUserId = rows[0].id

      await sql`
        insert into balances (
          user_id,
          schmeckles
        )
        values (
          ${oxnetUserId},
          0
        )
        on conflict (user_id)
        do nothing
      `

      const session = await createSignedToken(
        {
          user_id: Number(oxnetUserId),
          twitch_user_id: twitchUser.id,
          login: twitchUser.login,
          display_name: twitchUser.display_name,
          exp: Date.now() + 7 * 24 * 60 * 60 * 1000
        },
        env.AUTH_SECRET
      )

      return Response.redirect(
        `${SITE_URL}/#session=${encodeURIComponent(session)}`,
        302
      )
    } catch (error) {
      console.error('Twitch auth callback failed:', error)
      return Response.redirect(`${SITE_URL}/#auth=error`, 302)
    }
  }

  return null
}
