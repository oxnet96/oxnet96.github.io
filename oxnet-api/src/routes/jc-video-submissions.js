import { getSession } from '../lib/auth.js'
import { jsonResponse } from '../lib/http.js'

const REDEMPTION_KEY = 'jc_video_queue'

function cleanText (value, maxLength) {
  return String(value || '')
    .trim()
    .slice(0, maxLength)
}

function parseDuration (value) {
  const number = Number(value)

  if (!Number.isInteger(number) || number <= 0) {
    return null
  }

  return number
}

function parseVideoUrl (value) {
  const raw = String(value || '').trim()

  if (!raw || raw.length > 2048) {
    return null
  }

  try {
    const parsed = new URL(raw)

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

async function requireSession (context) {
  const { request, env, headers } = context

  const session = await getSession(request, env)

  if (!session) {
    return {
      session: null,
      response: jsonResponse(
        {
          authenticated: false,
          error: 'Authentication required'
        },
        401,
        headers
      )
    }
  }

  return {
    session,
    response: null
  }
}

async function getRedemption (sql) {
  const rows = await sql`
    select
      redemption_key,
      name,
      description,
      cost,
      enabled,
      max_duration_seconds
    from redemptions
    where redemption_key = ${REDEMPTION_KEY}
    limit 1
  `

  return rows[0] || null
}

async function submitVideo (context) {
  const { request, sql, headers } = context

  const auth = await requireSession(context)

  if (auth.response) {
    return auth.response
  }

  let body

  try {
    body = await request.json()
  } catch {
    return jsonResponse(
      { error: 'Invalid JSON body' },
      400,
      headers
    )
  }

  const videoUrl = parseVideoUrl(body.video_url)
  const title = cleanText(body.title, 120)
  const note = cleanText(body.note, 500)
  const duration = parseDuration(body.duration_seconds)

  if (!videoUrl) {
    return jsonResponse(
      { error: 'A valid http/https video URL is required' },
      400,
      headers
    )
  }

  const redemption = await getRedemption(sql)

  if (!redemption || !redemption.enabled) {
    return jsonResponse(
      { error: 'This redemption is currently unavailable' },
      409,
      headers
    )
  }

  const maxDuration = Number(redemption.max_duration_seconds)

  if (!Number.isInteger(maxDuration) || maxDuration <= 0) {
    return jsonResponse(
      { error: 'Redemption duration limit is not configured' },
      503,
      headers
    )
  }

  if (!duration) {
    return jsonResponse(
      {
        error: 'Video duration is required',
        max_duration_seconds: maxDuration
      },
      400,
      headers
    )
  }

  if (duration > maxDuration) {
    return jsonResponse(
      {
        error: `Video must be ${maxDuration} seconds or shorter`,
        max_duration_seconds: maxDuration
      },
      400,
      headers
    )
  }

  const balanceRows = await sql`
    select schmeckles
    from balances
    where user_id = ${auth.session.user_id}
    limit 1
  `

  const currentBalance = Number(
    balanceRows[0]?.schmeckles || 0
  )

  const cost = Number(redemption.cost)

  if (currentBalance < cost) {
    return jsonResponse(
      {
        error: 'Not enough Schmeckles',
        schmeckles: currentBalance,
        required: cost
      },
      402,
      headers
    )
  }

  const duplicateRows = await sql`
    select id
    from jc_video_submissions
    where twitch_user_id = ${String(auth.session.twitch_user_id)}
      and video_url = ${videoUrl}
      and status = 'pending'
    limit 1
  `

  if (duplicateRows.length) {
    return jsonResponse(
      {
        error: 'That video is already pending review',
        submission_id: Number(duplicateRows[0].id)
      },
      409,
      headers
    )
  }

  const rows = await sql`
    insert into jc_video_submissions (
      redemption_key,
      twitch_user_id,
      twitch_login,
      twitch_display_name,
      video_url,
      title,
      note,
      claimed_duration_seconds,
      cost_snapshot,
      max_duration_seconds,
      status
    )
    values (
      ${REDEMPTION_KEY},
      ${String(auth.session.twitch_user_id)},
      ${String(auth.session.login || '')},
      ${String(auth.session.display_name || auth.session.login || '')},
      ${videoUrl},
      ${title},
      ${note},
      ${duration},
      ${cost},
      ${maxDuration},
      'pending'
    )
    returning
      id,
      video_url,
      title,
      note,
      claimed_duration_seconds,
      cost_snapshot,
      max_duration_seconds,
      status,
      submitted_at
  `

  return jsonResponse(
    {
      ok: true,
      charged: false,
      message: 'Submission received and awaiting review',
      submission: {
        id: Number(rows[0].id),
        video_url: rows[0].video_url,
        title: rows[0].title,
        note: rows[0].note,
        duration_seconds: rows[0].claimed_duration_seconds,
        cost: Number(rows[0].cost_snapshot),
        max_duration_seconds: rows[0].max_duration_seconds,
        status: rows[0].status,
        submitted_at: rows[0].submitted_at
      }
    },
    201,
    headers
  )
}

async function listMine (context) {
  const { sql, headers } = context

  const auth = await requireSession(context)

  if (auth.response) {
    return auth.response
  }

  const rows = await sql`
    select
      id,
      video_url,
      title,
      note,
      claimed_duration_seconds,
      cost_snapshot,
      max_duration_seconds,
      status,
      rejection_reason,
      queue_position,
      submitted_at,
      reviewed_at,
      approved_at,
      played_at
    from jc_video_submissions
    where twitch_user_id = ${String(auth.session.twitch_user_id)}
    order by submitted_at desc
    limit 100
  `

  return jsonResponse(
    {
      submissions: rows.map(row => ({
        id: Number(row.id),
        video_url: row.video_url,
        title: row.title,
        note: row.note,
        duration_seconds: row.claimed_duration_seconds,
        cost: Number(row.cost_snapshot),
        max_duration_seconds: row.max_duration_seconds,
        status: row.status,
        rejection_reason: row.rejection_reason,
        queue_position: row.queue_position,
        submitted_at: row.submitted_at,
        reviewed_at: row.reviewed_at,
        approved_at: row.approved_at,
        played_at: row.played_at
      }))
    },
    200,
    headers
  )
}

export async function handleJcVideoSubmissionRoutes (context) {
  const { request, url, headers } = context

  if (url.pathname === '/jc-video-submissions') {
    if (request.method !== 'POST') {
      return jsonResponse(
        { error: 'Method not allowed' },
        405,
        headers
      )
    }

    return submitVideo(context)
  }

  if (url.pathname === '/jc-video-submissions/mine') {
    if (request.method !== 'GET') {
      return jsonResponse(
        { error: 'Method not allowed' },
        405,
        headers
      )
    }

    return listMine(context)
  }

  return null
}
