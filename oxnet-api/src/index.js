import { neon } from '@neondatabase/serverless'
import { corsHeaders } from './lib/http.js'
import { handleTwitchRoutes } from './routes/twitch.js'
import { handleAccountRoutes } from './routes/account.js'
import { handleBalanceRoutes } from './routes/balances.js'
import { handleRedemptionRoutes } from './routes/redemptions.js'
import { handleGameRoutes } from './routes/games.js'

export default {
  async fetch (request, env) {
    const url = new URL(request.url)
    const headers = corsHeaders()

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    const sql = neon(env.DATABASE_URL)

    const context = {
      request,
      env,
      url,
      sql,
      headers
    }

    const handlers = [
      handleTwitchRoutes,
      handleAccountRoutes,
      handleBalanceRoutes,
      handleRedemptionRoutes,
      handleGameRoutes
    ]

    for (const handler of handlers) {
      const response = await handler(context)

      if (response) {
        return response
      }
    }

    return new Response(
      JSON.stringify({
        service: 'OXNET 96 API',
        status: 'online'
      }),
      { headers }
    )
  }
}
