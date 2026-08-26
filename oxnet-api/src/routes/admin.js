import {
  requireAdmin
} from '../lib/admin.js'

import {
  jsonResponse
} from '../lib/http.js'


export async function handleAdminRoutes (context) {
  const {
    url,
    headers
  } = context

  if (url.pathname !== '/admin/me') {
    return null
  }

  const admin =
    await requireAdmin(context)

  if (admin.response) {
    return admin.response
  }

  return jsonResponse(
    {
      authenticated: true,
      admin: true,
      user:
        admin.session.display_name ||
        admin.session.login,
      login:
        admin.session.login
    },
    200,
    headers
  )
}