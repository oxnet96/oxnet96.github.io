import { neon } from "@neondatabase/serverless";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const headers = {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "https://oxnet96.github.io",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    if (url.pathname === "/balance") {
      try {
        const sql = neon(env.DATABASE_URL);

        const rows = await sql`
          select
            u.twitch_login,
            u.twitch_display_name,
            b.schmeckles,
            b.synced_at
          from users u
          join balances b on b.user_id = u.id
          where u.twitch_user_id = 'dev_ox_king'
          limit 1
        `;

        if (rows.length === 0) {
          return Response.json(
            { error: "User not found" },
            { status: 404, headers }
          );
        }

        return new Response(
          JSON.stringify({
            user: rows[0].twitch_display_name,
            login: rows[0].twitch_login,
            schmeckles: Number(rows[0].schmeckles),
            synced_at: rows[0].synced_at
          }),
          { headers }
        );
      } catch (error) {
        console.error(error);

        return new Response(
          JSON.stringify({
            error: "Database connection failed"
          }),
          { status: 500, headers }
        );
      }
    }

    return new Response(
      JSON.stringify({
        service: "OXNET 96 API",
        status: "online"
      }),
      { headers }
    );
  }
};