import { neon } from "@neondatabase/serverless";

const SITE_URL = "https://oxnet96.github.io";
const CALLBACK_URL =
  "https://oxnet-api.markalexandermcdaniel.workers.dev/auth/twitch/callback";

function corsHeaders() {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": SITE_URL,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };
}

function base64UrlEncode(bytes) {
  return btoa(
    String.fromCharCode(...new Uint8Array(bytes))
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlEncodeString(value) {
  return btoa(
    unescape(encodeURIComponent(value))
  )
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecodeString(value) {
  value = value
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  while (value.length % 4) {
    value += "=";
  }

  return decodeURIComponent(
    escape(atob(value))
  );
}

async function hmac(secret, value) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      name: "HMAC",
      hash: "SHA-256"
    },
    false,
    ["sign"]
  );

  const signature =
    await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(value)
    );

  return base64UrlEncode(signature);
}

async function createSignedToken(payload, secret) {
  const encoded =
    base64UrlEncodeString(
      JSON.stringify(payload)
    );

  const signature =
    await hmac(secret, encoded);

  return `${encoded}.${signature}`;
}

async function verifySignedToken(token, secret) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [encoded, suppliedSignature] =
    token.split(".");

  const expectedSignature =
    await hmac(secret, encoded);

  if (suppliedSignature !== expectedSignature) {
    return null;
  }

  try {
    const payload =
      JSON.parse(
        base64UrlDecodeString(encoded)
      );

    if (
      payload.exp &&
      Date.now() > payload.exp
    ) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function randomHex(bytes = 24) {
  const array =
    crypto.getRandomValues(
      new Uint8Array(bytes)
    );

  return [...array]
    .map(value =>
      value.toString(16).padStart(2, "0")
    )
    .join("");
}

async function getSession(request, env) {
  const header =
    request.headers.get("Authorization");

  if (
    !header ||
    !header.startsWith("Bearer ")
  ) {
    return null;
  }

  const token =
    header.slice(7).trim();

  return verifySignedToken(
    token,
    env.AUTH_SECRET
  );
}

export default {
  async fetch(request, env) {
    const url =
      new URL(request.url);

    const headers =
      corsHeaders();

    if (request.method === "OPTIONS") {
      return new Response(
        null,
        { headers }
      );
    }

    const sql =
      neon(env.DATABASE_URL);

    /*
      ==================================================
      START TWITCH LOGIN
      ==================================================
    */

    if (url.pathname === "/auth/twitch") {
      const statePayload = {
        nonce: randomHex(),
        exp: Date.now() + 10 * 60 * 1000
      };

      const state =
        await createSignedToken(
          statePayload,
          env.AUTH_SECRET
        );

      const params =
        new URLSearchParams({
          client_id:
            env.TWITCH_CLIENT_ID,

          redirect_uri:
            CALLBACK_URL,

          response_type:
            "code",

          scope:
            "user:read:email",

          state
        });

      return Response.redirect(
        `https://id.twitch.tv/oauth2/authorize?${params.toString()}`,
        302
      );
    }

    /*
      ==================================================
      TWITCH CALLBACK
      ==================================================
    */

    if (
      url.pathname ===
      "/auth/twitch/callback"
    ) {
      try {
        const error =
          url.searchParams.get("error");

        if (error) {
          return Response.redirect(
            `${SITE_URL}/#auth=denied`,
            302
          );
        }

        const code =
          url.searchParams.get("code");

        const state =
          url.searchParams.get("state");

        if (!code || !state) {
          return new Response(
            "Invalid Twitch callback.",
            { status: 400 }
          );
        }

        const validState =
          await verifySignedToken(
            state,
            env.AUTH_SECRET
          );

        if (!validState) {
          return new Response(
            "Invalid or expired OAuth state.",
            { status: 400 }
          );
        }

        /*
          Exchange Twitch authorization code
          for a user access token.
        */

        const tokenParams =
          new URLSearchParams({
            client_id:
              env.TWITCH_CLIENT_ID,

            client_secret:
              env.TWITCH_CLIENT_SECRET,

            code,

            grant_type:
              "authorization_code",

            redirect_uri:
              CALLBACK_URL
          });

        const tokenResponse =
          await fetch(
            "https://id.twitch.tv/oauth2/token",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded"
              },
              body:
                tokenParams.toString()
            }
          );

        if (!tokenResponse.ok) {
          console.error(
            "Twitch token exchange failed",
            await tokenResponse.text()
          );

          throw new Error(
            "Twitch token exchange failed"
          );
        }

        const tokenData =
          await tokenResponse.json();

        /*
          Get the logged-in Twitch user's
          identity.
        */

        const userResponse =
          await fetch(
            "https://api.twitch.tv/helix/users",
            {
              headers: {
                "Authorization":
                  `Bearer ${tokenData.access_token}`,

                "Client-Id":
                  env.TWITCH_CLIENT_ID
              }
            }
          );

        if (!userResponse.ok) {
          console.error(
            "Twitch user lookup failed",
            await userResponse.text()
          );

          throw new Error(
            "Twitch user lookup failed"
          );
        }

        const userData =
          await userResponse.json();

        const twitchUser =
          userData.data?.[0];

        if (!twitchUser) {
          throw new Error(
            "Twitch user missing"
          );
        }

        /*
          Create or update OXNET user.
        */

        const rows = await sql`
          insert into users (
            twitch_user_id,
            twitch_login,
            twitch_display_name,
            last_seen_at
          )
          values (
            ${twitchUser.id},
            ${twitchUser.login},
            ${twitchUser.display_name},
            now()
          )
          on conflict (twitch_user_id)
          do update set
            twitch_login =
              excluded.twitch_login,

            twitch_display_name =
              excluded.twitch_display_name,

            last_seen_at =
              now()

          returning id
        `;

        const oxnetUserId =
          rows[0].id;

        /*
          Every new viewer starts at zero.
          Existing balances remain untouched.
        */

        await sql`
          insert into balances (
            user_id,
            schmeckles
          )
          values (
            ${oxnetUserId},
            0
          )
          on conflict (user_id)
          do nothing
        `;

        /*
          Create OXNET session.
          Valid for 7 days.
        */

        const session =
          await createSignedToken(
            {
              user_id:
                Number(oxnetUserId),

              twitch_user_id:
                twitchUser.id,

              login:
                twitchUser.login,

              display_name:
                twitchUser.display_name,

              exp:
                Date.now() +
                7 * 24 * 60 * 60 * 1000
            },
            env.AUTH_SECRET
          );

        /*
          Put session in URL fragment.

          Fragments are not sent to GitHub's
          server. The frontend will capture it,
          store it, then immediately remove it
          from the address bar.
        */

        return Response.redirect(
          `${SITE_URL}/#session=${encodeURIComponent(session)}`,
          302
        );

      } catch (error) {
        console.error(
          "Twitch auth callback failed:",
          error
        );

        return Response.redirect(
          `${SITE_URL}/#auth=error`,
          302
        );
      }
    }

    /*
      ==================================================
      CURRENT LOGGED-IN USER
      ==================================================
    */

    if (url.pathname === "/me") {
      try {
        const session =
          await getSession(
            request,
            env
          );

        if (!session) {
          return new Response(
            JSON.stringify({
              authenticated: false
            }),
            {
              status: 401,
              headers
            }
          );
        }

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
          where u.id =
            ${session.user_id}
          limit 1
        `;

        if (!rows.length) {
          return new Response(
            JSON.stringify({
              authenticated: false
            }),
            {
              status: 404,
              headers
            }
          );
        }

        return new Response(
          JSON.stringify({
            authenticated: true,

            user:
              rows[0]
                .twitch_display_name,

            login:
              rows[0]
                .twitch_login,

            twitch_user_id:
              rows[0]
                .twitch_user_id,

            schmeckles:
              Number(
                rows[0].schmeckles
              ),

            synced_at:
              rows[0].synced_at
          }),
          {
            status: 200,
            headers
          }
        );

      } catch (error) {
        console.error(error);

        return new Response(
          JSON.stringify({
            error:
              "Account lookup failed"
          }),
          {
            status: 500,
            headers
          }
        );
      }
    }

    /*
      ==================================================
      STREAMER.BOT BALANCE SYNC
      ==================================================
    */

    if (url.pathname === "/bridge/sync-balance") {

      if (request.method !== "POST") {
        return new Response(
          JSON.stringify({
            error: "Method not allowed"
          }),
          {
            status: 405,
            headers
          }
        );
      }

      const authorization =
        request.headers.get("Authorization");

      if (
        authorization !==
        `Bearer ${env.BRIDGE_SECRET}`
      ) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized"
          }),
          {
            status: 401,
            headers
          }
        );
      }

      try {
        const body =
          await request.json();

        const twitchUserId =
          String(
            body.twitch_user_id || ""
          ).trim();

        const twitchLogin =
          String(
            body.twitch_login || ""
          ).trim();

        const twitchDisplayName =
          String(
            body.twitch_display_name ||
            twitchLogin
          ).trim();

        const schmeckles =
          Number(
            body.schmeckles
          );

        if (
          !twitchUserId ||
          !twitchLogin ||
          !Number.isInteger(schmeckles) ||
          schmeckles < 0
        ) {
          return new Response(
            JSON.stringify({
              error: "Invalid sync payload"
            }),
            {
              status: 400,
              headers
            }
          );
        }

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
            twitch_login =
              excluded.twitch_login,

            twitch_display_name =
              excluded.twitch_display_name,

            last_seen_at =
              now()

          returning id
        `;

        const userId =
          users[0].id;

        await sql`
          insert into balances (
            user_id,
            schmeckles,
            synced_at
          )
          values (
            ${userId},
            ${schmeckles},
            now()
          )

          on conflict (user_id)

          do update set
            schmeckles =
              excluded.schmeckles,

            synced_at =
              now()
        `;

        return new Response(
          JSON.stringify({
            success: true,
            twitch_user_id:
              twitchUserId,
            twitch_login:
              twitchLogin,
            schmeckles
          }),
          {
            status: 200,
            headers
          }
        );
      }

      catch (error) {
        console.error(
          "Bridge balance sync failed:",
          error
        );

        return new Response(
          JSON.stringify({
            error:
              "Balance sync failed"
          }),
          {
            status: 500,
            headers
          }
        );
      }
    }

    /*
  ==================================================
  REDEMPTION CATALOG
  ==================================================
*/

    if (url.pathname === "/redemptions") {
      try {
        const rows = await sql`
      select
        redemption_key,
        name,
        description,
        category,
        cost,
        cooldown_seconds,
        enabled
      from redemptions
      where enabled = true
      order by cost asc
    `;

        return new Response(
          JSON.stringify({
            redemptions: rows.map(item => ({
              key: item.redemption_key,
              name: item.name,
              description: item.description,
              category: item.category,
              cost: Number(item.cost),
              cooldown_seconds: item.cooldown_seconds,
              enabled: item.enabled
            }))
          }),
          {
            status: 200,
            headers
          }
        );
      }

      catch (error) {
        console.error(
          "Redemption catalog failed:",
          error
        );

        return new Response(
          JSON.stringify({
            error: "Redemption catalog failed"
          }),
          {
            status: 500,
            headers
          }
        );
      }
    }

    /*
      ==================================================
      TEMP DEV BALANCE ENDPOINT
      ==================================================

      We'll remove this once the live site is
      fully using /me.
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
          where
            u.twitch_user_id =
            'dev_ox_king'
          limit 1
        `;

        if (!rows.length) {
          return new Response(
            JSON.stringify({
              error:
                "User not found"
            }),
            {
              status: 404,
              headers
            }
          );
        }

        return new Response(
          JSON.stringify({
            user:
              rows[0]
                .twitch_display_name,

            login:
              rows[0]
                .twitch_login,

            schmeckles:
              Number(
                rows[0].schmeckles
              ),

            synced_at:
              rows[0].synced_at
          }),
          {
            status: 200,
            headers
          }
        );

      } catch (error) {
        console.error(error);

        return new Response(
          JSON.stringify({
            error:
              "Database connection failed"
          }),
          {
            status: 500,
            headers
          }
        );
      }
    }

    /*
      ==================================================
      API STATUS
      ==================================================
    */

    return new Response(
      JSON.stringify({
        service:
          "OXNET 96 API",

        status:
          "online"
      }),
      {
        headers
      }
    );
  }
};