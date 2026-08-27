import { isBridgeAuthorized, jsonResponse } from "../lib/http.js";

async function ensureCanonicalBalance(
  sql,
  twitchUserId,
  twitchLogin,
  twitchDisplayName,
) {
  const users = await sql`
    insert into users (
      twitch_user_id,
      twitch_login,
      twitch_display_name,
      last_seen_at
    )
    values (
      ${twitchUserId},
      ${twitchLogin},
      ${twitchDisplayName},
      now()
    )
    on conflict (twitch_user_id)
    do update set
      twitch_login = excluded.twitch_login,
      twitch_display_name = excluded.twitch_display_name,
      last_seen_at = now()
    returning id
  `;

  const userId = users[0].id;

  await sql`
    insert into balances (
      user_id,
      schmeckles,
      synced_at
    )
    values (
      ${userId},
      0,
      now()
    )
    on conflict (user_id) do nothing
  `;

  const rows = await sql`
    select
      u.twitch_user_id,
      u.twitch_login,
      u.twitch_display_name,
      b.schmeckles,
      b.synced_at
    from users u
    join balances b
      on b.user_id = u.id
    where u.id = ${userId}
    limit 1
  `;

  return {
    twitch_user_id: rows[0].twitch_user_id,
    twitch_login: rows[0].twitch_login,
    twitch_display_name: rows[0].twitch_display_name,
    schmeckles: Number(rows[0].schmeckles),
    synced_at: rows[0].synced_at,
  };
}

function readIdentity(body) {
  const twitchUserId = String(body.twitch_user_id || "").trim();
  const twitchLogin = String(body.twitch_login || "").trim();
  const twitchDisplayName = String(
    body.twitch_display_name || twitchLogin,
  ).trim();

  return {
    twitchUserId,
    twitchLogin,
    twitchDisplayName,
  };
}

export async function handleBalanceRoutes(context) {
  const { request, env, url, sql, headers } = context;

  /*
  ==================================================
  STREAMER.BOT CACHE CHANGE BRIDGE

  POST /bridge/sync-balance

  Phase 2 payload:
  {
    twitch_user_id,
    twitch_login,
    twitch_display_name,
    old_schmeckles,
    new_schmeckles,
    transaction_id
  }

  Neon accepts the proposed new value ONLY if its current
  canonical value still equals old_schmeckles.

  Old Phase 1 clients that only send `schmeckles` remain
  SAFE: they cannot overwrite Neon.
  ==================================================
  */

  if (url.pathname === "/bridge/sync-balance") {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    if (!isBridgeAuthorized(request, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    try {
      const body = await request.json();

      const {
        twitchUserId,
        twitchLogin,
        twitchDisplayName,
      } = readIdentity(body);

      if (!twitchUserId || !twitchLogin) {
        return jsonResponse(
          { error: "Invalid sync payload" },
          400,
          headers,
        );
      }

      const hasPhase2Fields =
        body.old_schmeckles !== undefined &&
        body.new_schmeckles !== undefined &&
        String(body.transaction_id || "").trim();

      // Compatibility mode: never trust the old one-way mirror payload.
      if (!hasPhase2Fields) {
        const canonical = await ensureCanonicalBalance(
          sql,
          twitchUserId,
          twitchLogin,
          twitchDisplayName,
        );

        return jsonResponse(
          {
            success: true,
            status: "legacy_read_only",
            ignored_local_balance: true,
            canonical_balance: canonical.schmeckles,
            ...canonical,
          },
          200,
          headers,
        );
      }

      const oldBalance = Number(body.old_schmeckles);
      const newBalance = Number(body.new_schmeckles);
      const transactionId = String(body.transaction_id || "")
        .trim()
        .slice(0, 200);

      if (
        !Number.isInteger(oldBalance) ||
        oldBalance < 0 ||
        !Number.isInteger(newBalance) ||
        newBalance < 0 ||
        !transactionId
      ) {
        return jsonResponse(
          { error: "Invalid cache change payload" },
          400,
          headers,
        );
      }

      const resultRows = await sql`
        select oxnet_apply_cache_change(
          ${transactionId},
          ${twitchUserId},
          ${twitchLogin},
          ${twitchDisplayName},
          ${oldBalance},
          ${newBalance},
          'Streamer.bot Schmeckles change',
          'streamerbot_cache_bridge'
        ) as result
      `;

      return jsonResponse(
        resultRows[0].result,
        200,
        headers,
      );
    } catch (error) {
      console.error("Balance cache bridge failed:", error);

      return jsonResponse(
        {
          error: "Balance cache bridge failed",
          detail: String(error?.message || ""),
        },
        500,
        headers,
      );
    }
  }


  /*
  ==================================================
  GET / CREATE ONE CANONICAL BALANCE
  ==================================================
  */

  if (url.pathname === "/bridge/bank/get") {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    if (!isBridgeAuthorized(request, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    try {
      const body = await request.json();

      const {
        twitchUserId,
        twitchLogin,
        twitchDisplayName,
      } = readIdentity(body);

      if (!twitchUserId || !twitchLogin) {
        return jsonResponse(
          { error: "Missing Twitch user fields" },
          400,
          headers,
        );
      }

      const canonical = await ensureCanonicalBalance(
        sql,
        twitchUserId,
        twitchLogin,
        twitchDisplayName,
      );

      return jsonResponse(
        {
          success: true,
          ...canonical,
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Bank balance lookup failed:", error);

      return jsonResponse(
        { error: "Bank balance lookup failed" },
        500,
        headers,
      );
    }
  }


  /*
  ==================================================
  LOAD ALL CANONICAL BALANCES INTO STREAMER.BOT CACHE

  GET /bridge/bank/all
  ==================================================
  */

  if (url.pathname === "/bridge/bank/all") {
    if (request.method !== "GET") {
      return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    if (!isBridgeAuthorized(request, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    try {
      const rows = await sql`
        select
          u.twitch_user_id,
          u.twitch_login,
          u.twitch_display_name,
          b.schmeckles,
          b.synced_at
        from users u
        join balances b
          on b.user_id = u.id
        order by u.id
      `;

      return jsonResponse(
        {
          success: true,
          count: rows.length,
          balances: rows.map((row) => ({
            twitch_user_id: row.twitch_user_id,
            twitch_login: row.twitch_login,
            twitch_display_name: row.twitch_display_name,
            schmeckles: Number(row.schmeckles),
            synced_at: row.synced_at,
          })),
        },
        200,
        headers,
      );
    } catch (error) {
      console.error("Bank cache hydration failed:", error);

      return jsonResponse(
        { error: "Bank cache hydration failed" },
        500,
        headers,
      );
    }
  }


  /*
  ==================================================
  DIRECT ATOMIC BANK TRANSACTION

  Kept for gradual migration away from local-cache writes.
  ==================================================
  */

  if (url.pathname === "/bridge/bank/transaction") {
    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405, headers);
    }

    if (!isBridgeAuthorized(request, env)) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    try {
      const body = await request.json();

      const transactionId = String(body.transaction_id || "")
        .trim()
        .slice(0, 200);

      const reason = String(body.reason || "Unspecified")
        .trim()
        .slice(0, 250);

      const source = String(body.source || "streamerbot")
        .trim()
        .slice(0, 100);

      const entries = Array.isArray(body.entries)
        ? body.entries
        : [];

      const metadata =
        body.metadata &&
        typeof body.metadata === "object" &&
        !Array.isArray(body.metadata)
          ? body.metadata
          : {};

      if (!transactionId) {
        return jsonResponse(
          { error: "transaction_id is required" },
          400,
          headers,
        );
      }

      if (entries.length < 1 || entries.length > 20) {
        return jsonResponse(
          { error: "entries must contain between 1 and 20 users" },
          400,
          headers,
        );
      }

      const normalizedEntries = entries.map((entry) => ({
        twitch_user_id: String(entry.twitch_user_id || "").trim(),
        twitch_login: String(entry.twitch_login || "").trim(),
        twitch_display_name: String(
          entry.twitch_display_name ||
          entry.twitch_login ||
          "",
        ).trim(),
        delta: Number(entry.delta),
      }));

      for (const entry of normalizedEntries) {
        if (
          !entry.twitch_user_id ||
          !entry.twitch_login ||
          !Number.isInteger(entry.delta)
        ) {
          return jsonResponse(
            { error: "Invalid bank transaction entry" },
            400,
            headers,
          );
        }
      }

      const resultRows = await sql`
        select oxnet_apply_schmeckle_batch(
          ${transactionId},
          ${JSON.stringify(normalizedEntries)}::jsonb,
          ${reason},
          ${source},
          ${JSON.stringify(metadata)}::jsonb
        ) as result
      `;

      return jsonResponse(
        resultRows[0].result,
        200,
        headers,
      );
    } catch (error) {
      console.error("Bank transaction failed:", error);

      const message = String(error?.message || "");

      if (message.includes("INSUFFICIENT_FUNDS:")) {
        return jsonResponse(
          {
            error: "Insufficient Schmeckles",
            detail: message,
          },
          409,
          headers,
        );
      }

      return jsonResponse(
        {
          error: "Bank transaction failed",
          detail: message,
        },
        500,
        headers,
      );
    }
  }


  /*
  ==================================================
  LEGACY DEV BALANCE ROUTE
  ==================================================
  */

  if (url.pathname === "/balance") {
    try {
      const rows = await sql`
        select
          u.twitch_login,
          u.twitch_display_name,
          b.schmeckles,
          b.synced_at
        from users u
        join balances b
          on b.user_id = u.id
        where u.twitch_user_id = 'dev_ox_king'
        limit 1
      `;

      if (!rows.length) {
        return jsonResponse({ error: "User not found" }, 404, headers);
      }

      return jsonResponse(
        {
          user: rows[0].twitch_display_name,
          login: rows[0].twitch_login,
          schmeckles: Number(rows[0].schmeckles),
          synced_at: rows[0].synced_at,
        },
        200,
        headers,
      );
    } catch (error) {
      console.error(error);

      return jsonResponse(
        { error: "Database connection failed" },
        500,
        headers,
      );
    }
  }

  return null;
}
