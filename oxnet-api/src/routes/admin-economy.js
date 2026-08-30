import { requireAdmin } from "../lib/admin.js";
import { jsonResponse } from "../lib/http.js";

function cleanText(value, maxLength = 250) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function mapUser(row) {
  return {
    id: Number(row.id),
    twitch_user_id: row.twitch_user_id,
    twitch_login: row.twitch_login,
    twitch_display_name: row.twitch_display_name,
    schmeckles: Number(row.schmeckles ?? 0),
    synced_at: row.synced_at,
    created_at: row.created_at,
    last_seen_at: row.last_seen_at,
  };
}

export async function handleAdminEconomyRoutes(context) {
  const { request, url, sql, headers } = context;

  if (!url.pathname.startsWith("/admin/economy")) {
    return null;
  }

  const admin = await requireAdmin(context);

  if (admin.response) {
    return admin.response;
  }

  /*
  ==================================================
  USER SEARCH

  GET /admin/economy/users?search=login
  ==================================================
  */

  if (
    url.pathname === "/admin/economy/users" &&
    request.method === "GET"
  ) {
    try {
      const search = cleanText(
        url.searchParams.get("search"),
        120,
      ).toLowerCase();

      let rows;

      if (search) {
        const pattern = `%${search}%`;

        rows = await sql`
          select
            u.id,
            u.twitch_user_id,
            u.twitch_login,
            u.twitch_display_name,
            u.created_at,
            u.last_seen_at,
            coalesce(b.schmeckles, 0) as schmeckles,
            b.synced_at
          from users u
          left join balances b
            on b.user_id = u.id
          where
            lower(u.twitch_login) like ${pattern}
            or lower(
              coalesce(u.twitch_display_name, '')
            ) like ${pattern}
            or u.twitch_user_id like ${pattern}
          order by
            u.last_seen_at desc,
            u.id desc
          limit 50
        `;
      } else {
        rows = await sql`
          select
            u.id,
            u.twitch_user_id,
            u.twitch_login,
            u.twitch_display_name,
            u.created_at,
            u.last_seen_at,
            coalesce(b.schmeckles, 0) as schmeckles,
            b.synced_at
          from users u
          left join balances b
            on b.user_id = u.id
          order by
            u.last_seen_at desc,
            u.id desc
          limit 50
        `;
      }

      return jsonResponse(
        {
          success: true,
          count: rows.length,
          users: rows.map(mapUser),
        },
        200,
        headers,
      );
    } catch (error) {
      console.error(
        "Admin economy user search failed:",
        error,
      );

      return jsonResponse(
        {
          error: "Unable to search economy users",
        },
        500,
        headers,
      );
    }
  }

  /*
  ==================================================
  USER DETAIL

  GET /admin/economy/user?twitch_user_id=123
  ==================================================
  */

  if (
    url.pathname === "/admin/economy/user" &&
    request.method === "GET"
  ) {
    try {
      const twitchUserId = cleanText(
        url.searchParams.get("twitch_user_id"),
        100,
      );

      if (!twitchUserId) {
        return jsonResponse(
          {
            error: "twitch_user_id is required",
          },
          400,
          headers,
        );
      }

      const users = await sql`
        select
          u.id,
          u.twitch_user_id,
          u.twitch_login,
          u.twitch_display_name,
          u.created_at,
          u.last_seen_at,
          coalesce(b.schmeckles, 0) as schmeckles,
          b.synced_at
        from users u
        left join balances b
          on b.user_id = u.id
        where u.twitch_user_id = ${twitchUserId}
        limit 1
      `;

      if (!users.length) {
        return jsonResponse(
          {
            error: "User not found",
          },
          404,
          headers,
        );
      }

      const transactions = await sql`
        select
          t.id,
          t.transaction_id,
          t.delta,
          t.balance_before,
          t.balance_after,
          t.created_at,
          b.reason,
          b.source,
          b.metadata
        from schmeckle_transactions t
        left join schmeckle_transaction_batches b
          on b.transaction_id = t.transaction_id
        where t.twitch_user_id = ${twitchUserId}
        order by t.id desc
        limit 50
      `;

      const gameRequests = await sql`
        select
          id,
          game_name,
          platform,
          request_code,
          cost_paid,
          priority,
          status,
          refund_status,
          requested_at,
          started_at,
          completed_at,
          refunded_at
        from game_requests
        where twitch_user_id = ${twitchUserId}
        order by requested_at desc
        limit 25
      `;

      return jsonResponse(
        {
          success: true,
          user: mapUser(users[0]),

          transactions: transactions.map(
            (row) => ({
              id: Number(row.id),
              transaction_id: row.transaction_id,
              delta: Number(row.delta),
              balance_before: Number(
                row.balance_before,
              ),
              balance_after: Number(
                row.balance_after,
              ),
              reason: row.reason,
              source: row.source,
              metadata: row.metadata,
              created_at: row.created_at,
            }),
          ),

          game_requests: gameRequests.map(
            (row) => ({
              id: Number(row.id),
              game_name: row.game_name,
              platform: row.platform,
              request_code: row.request_code,
              cost_paid: Number(row.cost_paid),
              priority: Number(row.priority),
              status: row.status,
              refund_status: row.refund_status,
              requested_at: row.requested_at,
              started_at: row.started_at,
              completed_at: row.completed_at,
              refunded_at: row.refunded_at,
            }),
          ),
        },
        200,
        headers,
      );
    } catch (error) {
      console.error(
        "Admin economy user detail failed:",
        error,
      );

      return jsonResponse(
        {
          error: "Unable to load economy user",
        },
        500,
        headers,
      );
    }
  }

  /*
  ==================================================
  LEDGER-BACKED BALANCE ADJUSTMENT

  POST /admin/economy/adjust

  {
    twitch_user_id,
    delta,
    reason
  }

  delta > 0 = give
  delta < 0 = take
  ==================================================
  */

  if (
    url.pathname === "/admin/economy/adjust" &&
    request.method === "POST"
  ) {
    try {
      const body = await request.json();

      const twitchUserId = cleanText(
        body.twitch_user_id,
        100,
      );

      const delta = Number(body.delta);

      const reason = cleanText(
        body.reason,
        250,
      );

      if (!twitchUserId) {
        return jsonResponse(
          {
            error: "twitch_user_id is required",
          },
          400,
          headers,
        );
      }

      if (
        !Number.isInteger(delta) ||
        delta === 0
      ) {
        return jsonResponse(
          {
            error:
              "delta must be a non-zero whole number",
          },
          400,
          headers,
        );
      }

      if (Math.abs(delta) > 10000000) {
        return jsonResponse(
          {
            error:
              "Adjustment exceeds admin safety limit",
          },
          400,
          headers,
        );
      }

      if (!reason) {
        return jsonResponse(
          {
            error:
              "Reason is required for admin adjustments",
          },
          400,
          headers,
        );
      }

      const users = await sql`
        select
          twitch_user_id,
          twitch_login,
          twitch_display_name
        from users
        where twitch_user_id = ${twitchUserId}
        limit 1
      `;

      if (!users.length) {
        return jsonResponse(
          {
            error: "User not found",
          },
          404,
          headers,
        );
      }

      const user = users[0];

      const transactionId =
        `admin:${twitchUserId}:${crypto.randomUUID()}`;

      const entries = [
        {
          twitch_user_id: user.twitch_user_id,
          twitch_login: user.twitch_login,
          twitch_display_name:
            user.twitch_display_name ||
            user.twitch_login,
          delta,
        },
      ];

      const metadata = {
        admin_twitch_user_id:
          admin.session.twitch_user_id,
        admin_login:
          admin.session.login,
        operation:
          delta > 0 ? "give" : "take",
      };

      const resultRows = await sql`
        select oxnet_apply_schmeckle_batch(
          ${transactionId},
          ${JSON.stringify(entries)}::jsonb,
          ${reason},
          'admin_portal',
          ${JSON.stringify(metadata)}::jsonb
        ) as result
      `;

      return jsonResponse(
        resultRows[0].result,
        200,
        headers,
      );
    } catch (error) {
      console.error(
        "Admin economy adjustment failed:",
        error,
      );

      const message =
        String(error?.message || "");

      if (
        message.includes(
          "INSUFFICIENT_FUNDS:",
        )
      ) {
        return jsonResponse(
          {
            error:
              "Adjustment would make the balance negative",
          },
          409,
          headers,
        );
      }

      return jsonResponse(
        {
          error:
            "Unable to apply economy adjustment",
          detail: message,
        },
        500,
        headers,
      );
    }
  }

  return null;
}