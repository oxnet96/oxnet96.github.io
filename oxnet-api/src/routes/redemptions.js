import { getSession } from '../lib/auth.js'
import { jsonResponse } from '../lib/http.js'

async function redeemRewind (context) {
  const {
    request,
    env,
    sql,
    headers
  } = context

  const session =
    await getSession(
      request,
      env
    )

  if (!session) {
    return jsonResponse(
      {
        authenticated: false,
        error: 'Authentication required'
      },
      401,
      headers
    )
  }

  const transactionId =
    `redemption:rewind:${session.twitch_user_id}:${crypto.randomUUID()}`

  try {
    const rows = await sql`
      select oxnet_redeem_rewind(
        ${transactionId},
        ${String(session.twitch_user_id)},
        ${String(session.login || '')},
        ${String(
          session.display_name ||
          session.login ||
          ''
        )}
      ) as result
    `

    return jsonResponse(
      {
        ok: true,
        ...rows[0].result
      },
      200,
      headers
    )
  } catch (error) {
    const message =
      String(
        error?.message || ''
      )

    console.error(
      'REWIND redemption failed:',
      error
    )

    if (
      message.includes(
        'INSUFFICIENT_FUNDS'
      )
    ) {
      return jsonResponse(
        {
          error:
            'Not enough Schmeckles'
        },
        402,
        headers
      )
    }

    if (
      message.includes(
        'REDEMPTION_UNAVAILABLE'
      )
    ) {
      return jsonResponse(
        {
          error:
            'REWIND is currently unavailable'
        },
        409,
        headers
      )
    }

    if (
      message.includes(
        'REDEMPTION_COOLDOWN:'
      )
    ) {
      const match =
        message.match(
          /REDEMPTION_COOLDOWN:(\d+)/
        )

      const retryAfter =
        match
          ? Number(match[1])
          : null

      return jsonResponse(
        {
          error:
            'REWIND is on cooldown',
          retry_after_seconds:
            retryAfter
        },
        429,
        headers
      )
    }

    return jsonResponse(
      {
        error:
          'Unable to redeem REWIND',
        detail:
          message
      },
      500,
      headers
    )
  }
}

export async function handleRedemptionRoutes (
  context
) {
  const {
    request,
    url,
    sql,
    headers
  } = context

  if (
    url.pathname ===
    '/redemptions/rewind'
  ) {
    if (
      request.method !==
      'POST'
    ) {
      return jsonResponse(
        {
          error:
            'Method not allowed'
        },
        405,
        headers
      )
    }

    return redeemRewind(
      context
    )
  }

  if (
    url.pathname !==
    '/redemptions'
  ) {
    return null
  }

  if (
    request.method !==
    'GET'
  ) {
    return jsonResponse(
      {
        error:
          'Method not allowed'
      },
      405,
      headers
    )
  }

  try {
    const rows = await sql`
      select
        redemption_key,
        name,
        description,
        category,
        cost,
        cooldown_seconds,
        enabled,
        max_duration_seconds
      from redemptions
      where enabled = true
      order by cost asc
    `

    return jsonResponse(
      {
        redemptions:
          rows.map(
            item => ({
              key:
                item.redemption_key,

              name:
                item.name,

              description:
                item.description,

              category:
                item.category,

              cost:
                Number(
                  item.cost
                ),

              cooldown_seconds:
                item.cooldown_seconds,

              enabled:
                item.enabled,

              max_duration_seconds:
                item.max_duration_seconds
            })
          )
      },
      200,
      headers
    )
  } catch (error) {
    console.error(
      'Redemption catalog failed:',
      error
    )

    return jsonResponse(
      {
        error:
          'Redemption catalog failed'
      },
      500,
      headers
    )
  }
}
