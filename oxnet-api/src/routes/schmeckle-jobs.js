import { isBridgeAuthorized, jsonResponse } from "../lib/http.js";

export async function handleSchmeckleJobRoutes(context) {
  const { request, env, url, sql, headers } = context;

  if (!url.pathname.startsWith("/bridge/schmeckle-jobs")) {
    return null;
  }

  if (!isBridgeAuthorized(request, env)) {
    return jsonResponse(
      {
        error: "Unauthorized",
      },
      401,
      headers,
    );
  }

  /*
    ================================================
    CLAIM NEXT REFUND JOB

    POST /bridge/schmeckle-jobs/claim
    ================================================

    This atomically changes one pending job to
    "processing" before returning it.

    If Streamer.bot disappears after claiming it,
    the job stays processing rather than being
    automatically paid twice.
  */

  if (
    url.pathname === "/bridge/schmeckle-jobs/claim" &&
    request.method === "POST"
  ) {
    try {
      const rows = await sql`
          with next_job as (
            select
              id
            from schmeckle_jobs
            where
              status = 'pending'
              and job_type = 'refund'
            order by
              created_at asc,
              id asc
            for update skip locked
            limit 1
          )

          update schmeckle_jobs as j

          set
            status = 'processing',
            attempts = j.attempts + 1,
            processed_at = now(),
            last_error = null

          from next_job

          where
            j.id = next_job.id

          returning
            j.id,
            j.job_type,
            j.twitch_user_id,
            j.amount,
            j.source_type,
            j.source_id,
            j.status,
            j.attempts,
            j.created_at,
            j.processed_at
        `;

      if (!rows.length) {
        return jsonResponse(
          {
            success: true,
            job: null,
          },
          200,
          headers,
        );
      }

      const job = rows[0];

      return jsonResponse(
        {
          success: true,

          job: {
            id: Number(job.id),

            job_type: job.job_type,

            twitch_user_id: job.twitch_user_id,

            amount: Number(job.amount),

            source_type: job.source_type,

            source_id: job.source_id ? Number(job.source_id) : null,

            status: job.status,

            attempts: Number(job.attempts),

            created_at: job.created_at,

            processed_at: job.processed_at,
          },
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Schmeckle job claim failed:", error);

      return jsonResponse(
        {
          error: "Unable to claim Schmeckle job",
        },
        500,
        headers,
      );
    }
  }

  /*
    ================================================
    COMPLETE REFUND JOB

    POST /bridge/schmeckle-jobs/complete

    {
      "job_id": 12
    }
    ================================================

    Streamer.bot calls this ONLY AFTER it has
    successfully changed the authoritative balance.

    If this came from a rejected game request,
    the game request's refund status is also marked
    completed.
  */

  if (
    url.pathname === "/bridge/schmeckle-jobs/complete" &&
    request.method === "POST"
  ) {
    try {
      const body = await request.json();

      const jobId = Number(body.job_id);

      if (!Number.isInteger(jobId) || jobId <= 0) {
        return jsonResponse(
          {
            error: "Invalid job ID",
          },
          400,
          headers,
        );
      }

      const rows = await sql`
          with completed_job as (
            update schmeckle_jobs

            set
              status = 'completed',
              completed_at = now(),
              last_error = null

            where
              id = ${jobId}
              and status = 'processing'

            returning
              id,
              source_type,
              source_id
          ),

          updated_request as (
            update game_requests as g

            set
              refund_status =
                'completed',

              refunded_at =
                now()

            from completed_job as j

            where
              j.source_type =
                'game_request'

              and g.id =
                j.source_id

            returning
              g.id
          )

          select
            (
              select id
              from completed_job
            ) as job_id,

            (
              select id
              from updated_request
            ) as game_request_id
        `;

      if (!rows.length || !rows[0].job_id) {
        return jsonResponse(
          {
            error: "Refund job is not processing",
          },
          409,
          headers,
        );
      }

      return jsonResponse(
        {
          success: true,

          job_id: Number(rows[0].job_id),

          game_request_id: rows[0].game_request_id
            ? Number(rows[0].game_request_id)
            : null,
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Schmeckle job completion failed:", error);

      return jsonResponse(
        {
          error: "Unable to complete Schmeckle job",
        },
        500,
        headers,
      );
    }
  }

  /*
    ================================================
    FAIL REFUND JOB

    POST /bridge/schmeckle-jobs/fail

    {
      "job_id": 12,
      "error": "Streamer.bot balance update failed"
    }
    ================================================
  */

  if (
    url.pathname === "/bridge/schmeckle-jobs/fail" &&
    request.method === "POST"
  ) {
    try {
      const body = await request.json();

      const jobId = Number(body.job_id);

      const errorMessage = String(body.error || "Unknown Streamer.bot error")
        .trim()
        .slice(0, 500);

      if (!Number.isInteger(jobId) || jobId <= 0) {
        return jsonResponse(
          {
            error: "Invalid job ID",
          },
          400,
          headers,
        );
      }

      const rows = await sql`
          update schmeckle_jobs

          set
            status = 'failed',
            last_error =
              ${errorMessage}

          where
            id = ${jobId}
            and status = 'processing'

          returning
            id,
            source_type,
            source_id
        `;

      if (!rows.length) {
        return jsonResponse(
          {
            error: "Refund job is not processing",
          },
          409,
          headers,
        );
      }

      /*
        Keep the rejected game visibly marked
        as having a failed refund.
      */

      if (rows[0].source_type === "game_request" && rows[0].source_id) {
        await sql`
          update game_requests

          set
            refund_status =
              'failed'

          where
            id =
              ${rows[0].source_id}
        `;
      }

      return jsonResponse(
        {
          success: true,

          job_id: Number(rows[0].id),
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Schmeckle job failure update failed:", error);

      return jsonResponse(
        {
          error: "Unable to fail Schmeckle job",
        },
        500,
        headers,
      );
    }
  }

  return jsonResponse(
    {
      error: "Schmeckle job route not found",
    },
    404,
    headers,
  );
}
