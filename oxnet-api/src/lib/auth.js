function base64UrlEncode (bytes) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlEncodeString (value) {
  return btoa(unescape(encodeURIComponent(value)))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

function base64UrlDecodeString (value) {
  value = value.replaceAll('-', '+').replaceAll('_', '/')

  while (value.length % 4) {
    value += '='
  }

  return decodeURIComponent(escape(atob(value)))
}

async function hmac (secret, value) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(value)
  )

  return base64UrlEncode(signature)
}

export async function createSignedToken (payload, secret) {
  const encoded = base64UrlEncodeString(JSON.stringify(payload))
  const signature = await hmac(secret, encoded)
  return `${encoded}.${signature}`
}

export async function verifySignedToken (token, secret) {
  if (!token || !token.includes('.')) {
    return null
  }

  const [encoded, suppliedSignature] = token.split('.')
  const expectedSignature = await hmac(secret, encoded)

  if (suppliedSignature !== expectedSignature) {
    return null
  }

  try {
    const payload = JSON.parse(base64UrlDecodeString(encoded))

    if (payload.exp && Date.now() > payload.exp) {
      return null
    }

    return payload
  } catch {
    return null
  }
}

export function randomHex (bytes = 24) {
  const array = crypto.getRandomValues(new Uint8Array(bytes))

  return [...array]
    .map(value => value.toString(16).padStart(2, '0'))
    .join('')
}

export async function getSession (request, env) {
  const header = request.headers.get('Authorization')

  if (!header || !header.startsWith('Bearer ')) {
    return null
  }

  const token = header.slice(7).trim()
  return verifySignedToken(token, env.AUTH_SECRET)
}
