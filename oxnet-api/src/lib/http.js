import { SITE_URL } from '../config.js'

export function corsHeaders () {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': SITE_URL,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}

export function jsonResponse (body, status, headers) {
  return new Response(
    JSON.stringify(body),
    { status, headers }
  )
}

export function isBridgeAuthorized (request, env) {
  const authorization =
    request.headers.get('Authorization') || ''

  return authorization === `Bearer ${env.BRIDGE_SECRET}`
}
