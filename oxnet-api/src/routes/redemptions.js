import { jsonResponse } from '../lib/http.js'

export async function handleRedemptionRoutes (context) {
  const { url, sql, headers } = context

  if (url.pathname !== '/redemptions') {
    return null
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
        enabled
      from redemptions
      where enabled = true
      order by cost asc
    `

    return jsonResponse(
      {
        redemptions: rows.map(item => ({
          key: item.redemption_key,
          name: item.name,
          description: item.description,
          category: item.category,
          cost: Number(item.cost),
          cooldown_seconds: item.cooldown_seconds,
          enabled: item.enabled
        }))
      },
      200,
      headers
    )
  } catch (error) {
    console.error('Redemption catalog failed:', error)
    return jsonResponse(
      { error: 'Redemption catalog failed' },
      500,
      headers
    )
  }
}
