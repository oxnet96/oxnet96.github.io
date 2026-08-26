import {
  getSession
} from './auth.js'

import {
  jsonResponse
} from './http.js'


export async function requireAdmin (context) {
  const {
    request,
    env,
    headers
  } = context

  /*
    Must have a valid signed OXNET
    Twitch session.
  */

  const session =
    await getSession(
      request,
      env
    )

  if (!session) {
    return {
      session: null,

      response:
        jsonResponse(
          {
            authenticated: false,
            admin: false,
            error:
              'Authentication required'
          },
          401,
          headers
        )
    }
  }


  /*
    Fail closed if the Worker
    was deployed without an
    administrator configured.
  */

  if (
    !env.ADMIN_TWITCH_USER_ID
  ) {
    console.error(
      'OXNET ADMIN: ADMIN_TWITCH_USER_ID is not configured'
    )

    return {
      session: null,

      response:
        jsonResponse(
          {
            authenticated: true,
            admin: false,
            error:
              'Admin system unavailable'
          },
          503,
          headers
        )
    }
  }


  /*
    Twitch numeric user ID is the
    authoritative administrator ID.

    We intentionally do NOT compare
    Twitch usernames because those
    can be changed.
  */

  if (
    String(
      session.twitch_user_id
    ) !==
    String(
      env.ADMIN_TWITCH_USER_ID
    )
  ) {
    console.warn(
      `OXNET ADMIN DENIED: ${session.login || 'unknown'}`
    )

    return {
      session: null,

      response:
        jsonResponse(
          {
            authenticated: true,
            admin: false,
            error:
              'Admin access denied'
          },
          403,
          headers
        )
    }
  }


  /*
    Authorized administrator.
  */

  return {
    session,
    response: null
  }
}
