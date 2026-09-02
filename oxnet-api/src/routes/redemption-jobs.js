import {
  isBridgeAuthorized,
  jsonResponse
} from '../lib/http.js'

export async function handleRedemptionJobRoutes (
  context
) {
  const {
    request,
    env,
    url,
    sql,
    headers
  } = context

  if (
    !url.pathname.startsWith(
      '/bridge/redemption-jobs'
    )
  ) {
    return null
  }

  if (
    !isBridgeAuthorized(
      request,
      env
    )
  ) {
    return jsonResponse(
      {
        error: 'Unauthorized'
      },
      401,
      headers
    )
  }

  /*
    CLAIM NEXT REDEMPTION
  */
  if (
    url.pathname ===
      '/bridge/redemption-jobs/claim' &&
    request.method === 'POST'
  ) {
    try {
      const rows = await sql`
        with next_job as (
          select id
          from redemption_jobs
          where status = 'pending'
          order by
            created_at asc,
            id asc
          for update skip locked
          limit 1
        )

        update redemption_jobs as j
        set
          status = 'processing',
          attempts = j.attempts + 1,
          claimed_at = now(),
          last_error = null
        from next_job
        where j.id = next_job.id
        returning
          j.id,
          j.redemption_key,
          j.twitch_user_id,
          j.twitch_login,
          j.twitch_display_name,
          j.cost_snapshot,
          j.cooldown_seconds_snapshot,
          j.balance_after,
          j.status,
          j.attempts,
          j.created_at,
          j.claimed_at
      `

      if (!rows.length) {
        return jsonResponse(
          {
            success: true,
            job: null
          },
          200,
          headers
        )
      }

      const job = rows[0]

      return jsonResponse(
        {
          success: true,

          job: {
            id:
              Number(job.id),

            redemption_key:
              job.redemption_key,

            twitch_user_id:
              job.twitch_user_id,

            twitch_login:
              job.twitch_login,

            twitch_display_name:
              job.twitch_display_name,

            cost:
              Number(
                job.cost_snapshot
              ),

            cooldown_seconds:
              Number(
                job.cooldown_seconds_snapshot
              ),

            balance_after:
              Number(
                job.balance_after
              ),

            status:
              job.status,

            attempts:
              Number(job.attempts),

            created_at:
              job.created_at,

            claimed_at:
              job.claimed_at
          }
        },
        200,
        headers
      )
    } catch (error) {
      console.error(
        'Redemption job claim failed:',
        error
      )

      return jsonResponse(
        {
          error:
            'Unable to claim redemption job'
        },
        500,
        headers
      )
    }
  }

  /*
    MARK SUCCESSFUL
  */
  if (
    url.pathname ===
      '/bridge/redemption-jobs/complete' &&
    request.method === 'POST'
  ) {
    try {
      const body =
        await request.json()

      const jobId =
        Number(body.job_id)

      if (
        !Number.isInteger(jobId) ||
        jobId <= 0
      ) {
        return jsonResponse(
          {
            error:
              'Invalid job ID'
          },
          400,
          headers
        )
      }

      const rows = await sql`
        update redemption_jobs
        set
          status = 'completed',
          completed_at = now(),
          last_error = null
        where
          id = ${jobId}
          and status = 'processing'
        returning id
      `

      if (!rows.length) {
        return jsonResponse(
          {
            error:
              'Redemption job is not processing'
          },
          409,
          headers
        )
      }

      return jsonResponse(
        {
          success: true,
          job_id:
            Number(rows[0].id)
        },
        200,
        headers
      )
    } catch (error) {
      console.error(
        'Redemption completion failed:',
        error
      )

      return jsonResponse(
        {
          error:
            'Unable to complete redemption job'
        },
        500,
        headers
      )
    }
  }

  /*
    MARK FAILED + AUTOMATIC REFUND
  */
  if (
    url.pathname ===
      '/bridge/redemption-jobs/fail' &&
    request.method === 'POST'
  ) {
    try {
      const body =
        await request.json()

      const jobId =
        Number(body.job_id)

      const errorMessage =
        String(
          body.error ||
          'Unknown fulfillment error'
        )
          .trim()
          .slice(0, 500)

      if (
        !Number.isInteger(jobId) ||
        jobId <= 0
      ) {
        return jsonResponse(
          {
            error:
              'Invalid job ID'
          },
          400,
          headers
        )
      }

      let rows = await sql`
        update redemption_jobs
        set
          status = 'failed',
          failed_at = now(),
          last_error =
            ${errorMessage}
        where
          id = ${jobId}
          and status = 'processing'
        returning *
      `

      /*
        Allows a failed refund to be
        retried safely.
      */
      if (!rows.length) {
        rows = await sql`
          select *
          from redemption_jobs
          where
            id = ${jobId}
            and status = 'failed'
          limit 1
        `
      }

      if (!rows.length) {
        return jsonResponse(
          {
            error:
              'Redemption job cannot be failed'
          },
          409,
          headers
        )
      }

      const job = rows[0]

      const refundTransactionId =
        `redemption:refund:${job.id}`

      const entries = [
        {
          twitch_user_id:
            job.twitch_user_id,

          twitch_login:
            job.twitch_login,

          twitch_display_name:
            job.twitch_display_name,

          delta:
            Number(
              job.cost_snapshot
            )
        }
      ]

      const resultRows = await sql`
        select oxnet_apply_schmeckle_batch(
          ${refundTransactionId},
          ${JSON.stringify(entries)}::jsonb,
          ${`Refund failed ${job.redemption_key} redemption`},
          'oxnet_redemption_refund',
          ${JSON.stringify({
            redemption_job_id:
              Number(job.id),

            redemption_key:
              job.redemption_key
          })}::jsonb
        ) as result
      `

      await sql`
        update redemption_jobs
        set
          status = 'refunded',
          refunded_at = now(),
          refund_transaction_id =
            ${refundTransactionId}
        where
          id = ${jobId}
          and status = 'failed'
      `

      return jsonResponse(
        {
          success: true,
          refunded: true,
          job_id:
            Number(job.id),

          amount:
            Number(
              job.cost_snapshot
            ),

          result:
            resultRows[0].result
        },
        200,
        headers
      )
    } catch (error) {
      console.error(
        'Redemption failure/refund failed:',
        error
      )

      return jsonResponse(
        {
          error:
            'Unable to fail/refund redemption job',

          detail:
            String(
              error?.message || ''
            )
        },
        500,
        headers
      )
    }
  }

  return jsonResponse(
    {
      error:
        'Redemption job route not found'
    },
    404,
    headers
  )
}
