import { enforceLimit } from "./utils/limits";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const REDIRECT_URI =
  "https://lensically-worker.lensically.workers.dev/auth/threads/callback";
const SCOPES = [
  "threads_basic",
  "threads_manage_insights",
  "threads_keyword_search",
  "threads_profile_discovery",
  "threads_content_publish",
].join(",");
const API_OAUTH_REDIRECT_URI =
  "https://lensically-worker.lensically.workers.dev/api/auth/threads/callback";
const API_OAUTH_SCOPES = [
  "threads_basic",
  "threads_manage_insights",
].join(",");

interface Env {
  THREADS_CLIENT_ID: string;
  THREADS_CLIENT_SECRET: string;
  INTERNAL_API_KEY: string;
  WEB_APP_URL?: string;
  DB: D1Database;
}

async function runLimitCheck(
  env: Env,
  userId: string,
  column: "me_calls" | "insights_calls" | "publish_calls" | "keyword_calls" | "discovery_calls",
  limit: number,
): Promise<Response | null> {
  try {
    await enforceLimit(env, userId, column, limit);
    return null;
  } catch (error) {
    if (error instanceof Response) {
      return error;
    }
    throw error;
  }
}

function getCookieValue(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = cookie.trim().split("=");
    if (rawKey === name) {
      return rawValue.join("=");
    }
  }
  return null;
}

async function checkUserCapacity(
  env: Env,
  threadsUserId: string,
): Promise<Response | null> {
  const existing = await env.DB.prepare(
    "SELECT threads_user_id FROM threads_accounts WHERE threads_user_id = ? LIMIT 1",
  )
    .bind(threadsUserId)
    .first<{ threads_user_id: string }>();

  if (existing) {
    return null;
  }

  const users = await env.DB.prepare(
    "SELECT COUNT(*) AS total FROM threads_accounts",
  ).first<{ total: number | string }>();

  if (Number(users?.total ?? 0) >= 800) {
    return new Response(
      JSON.stringify({ error: "user capacity reached" }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  return null;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (url.pathname === "/connect/threads") {
      return Response.redirect(
        "https://lensically-worker.lensically.workers.dev/auth/threads/login",
        302
      );
    }

    if (url.pathname === "/api/auth/threads/start" && request.method === "GET") {
      const state = crypto.randomUUID().replace(/-/g, "");
      const authURL = new URL("https://graph.threads.net/oauth/authorize");
      authURL.searchParams.set("client_id", env.THREADS_CLIENT_ID);
      authURL.searchParams.set("redirect_uri", API_OAUTH_REDIRECT_URI);
      authURL.searchParams.set("scope", API_OAUTH_SCOPES);
      authURL.searchParams.set("response_type", "code");
      authURL.searchParams.set("state", state);

      return new Response(null, {
        status: 302,
        headers: {
          Location: authURL.toString(),
          "Set-Cookie": `lensically_oauth_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`,
        },
      });
    }

    if (url.pathname === "/api/auth/threads/callback" && request.method === "GET") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookieState = getCookieValue(request, "lensically_oauth_state");

      if (!code || !state || !cookieState || state !== cookieState) {
        return new Response(
          JSON.stringify({ error: "Invalid OAuth state" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const tokenBody = new URLSearchParams({
        client_id: env.THREADS_CLIENT_ID,
        client_secret: env.THREADS_CLIENT_SECRET,
        redirect_uri: API_OAUTH_REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      });

      const tokenResp = await fetch("https://graph.threads.net/oauth/access_token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: tokenBody,
      });

      if (!tokenResp.ok) {
        return new Response(await tokenResp.text(), {
          status: tokenResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const shortTokenData = await tokenResp.json() as { access_token?: string };
      const shortToken = shortTokenData.access_token;
      if (!shortToken) {
        return new Response(
          JSON.stringify({ error: "Missing short-lived access token" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const longResp = await fetch(
        `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.THREADS_CLIENT_SECRET}&access_token=${shortToken}`,
      );

      if (!longResp.ok) {
        return new Response(await longResp.text(), {
          status: longResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const longTokenData = await longResp.json() as {
        access_token?: string;
        expires_in?: number;
      };
      const accessToken = longTokenData.access_token;
      const expiresIn = Number(longTokenData.expires_in ?? 0);

      if (!accessToken || !expiresIn) {
        return new Response(
          JSON.stringify({ error: "Invalid long-lived token response" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const meResp = await fetch(
        `https://graph.threads.net/me?fields=id&access_token=${accessToken}`,
      );
      if (!meResp.ok) {
        return new Response(await meResp.text(), {
          status: meResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const meData = await meResp.json() as { id?: string };
      if (!meData.id) {
        return new Response(
          JSON.stringify({ error: "Missing Threads user id" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const userCapacityResponse = await checkUserCapacity(env, meData.id);
      if (userCapacityResponse) {
        return userCapacityResponse;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + expiresIn;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO threads_accounts (threads_user_id, access_token, expires_at)
         VALUES (?, ?, ?)`,
      )
        .bind(meData.id, accessToken, expiresAt)
        .run();

      if (!env.WEB_APP_URL) {
        return new Response(
          JSON.stringify({ error: "WEB_APP_URL is not configured" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const destination = `${env.WEB_APP_URL.replace(/\/$/, "")}/dashboard?connected=1`;

      return new Response(null, {
        status: 302,
        headers: {
          Location: destination,
          "Set-Cookie": "lensically_oauth_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0",
        },
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "lensically-worker",
          time: Math.floor(Date.now() / 1000),
        }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/connect/success" && request.method === "GET") {
      return new Response(
        `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Lensically</title>
  </head>
  <body>
    <p>Threads account connected successfully.</p>
    <a href="/">Return to Lensically</a>
  </body>
</html>`,
        {
          status: 200,
          headers: { "content-type": "text/html; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/auth/threads/login") {
      const authURL = new URL("https://graph.threads.net/oauth/authorize");
      authURL.searchParams.set("client_id", env.THREADS_CLIENT_ID);
      authURL.searchParams.set("redirect_uri", REDIRECT_URI);
      authURL.searchParams.set("scope", SCOPES);
      authURL.searchParams.set("response_type", "code");
      return Response.redirect(authURL.toString(), 302);
    }

    if (url.pathname === "/auth/threads/callback") {
      const code = url.searchParams.get("code");
      if (!code) {
        return new Response(
          JSON.stringify({ error: "Missing OAuth code" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const body = new URLSearchParams({
        client_id: env.THREADS_CLIENT_ID,
        client_secret: env.THREADS_CLIENT_SECRET,
        redirect_uri: REDIRECT_URI,
        grant_type: "authorization_code",
        code,
      });

      const tokenResp = await fetch(
        "https://graph.threads.net/oauth/access_token",
        {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        },
      );

      if (!tokenResp.ok) {
        return new Response(await tokenResp.text(), {
          status: tokenResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const shortTokenData = await tokenResp.json() as {
        access_token?: string;
      };
      const shortToken = shortTokenData.access_token;
      if (!shortToken) {
        return new Response(
          JSON.stringify({ error: "Missing short-lived access token" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const longResp = await fetch(
        `https://graph.threads.net/access_token?grant_type=th_exchange_token&client_secret=${env.THREADS_CLIENT_SECRET}&access_token=${shortToken}`,
      );

      if (!longResp.ok) {
        return new Response(await longResp.text(), {
          status: longResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const longTokenData = await longResp.json() as {
        access_token?: string;
        expires_in?: number;
      };
      const accessToken = longTokenData.access_token;
      const expiresIn = Number(longTokenData.expires_in ?? 0);

      if (!accessToken || !expiresIn) {
        return new Response(
          JSON.stringify({ error: "Invalid long-lived token response" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const meResp = await fetch("https://graph.threads.net/v1.0/me?fields=id", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!meResp.ok) {
        return new Response(await meResp.text(), {
          status: meResp.status,
          headers: { "content-type": "application/json; charset=UTF-8" },
        });
      }

      const meData = await meResp.json() as { id?: string };
      if (!meData.id) {
        return new Response(
          JSON.stringify({ error: "Missing Threads user id" }),
          {
            status: 500,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const userCapacityResponse = await checkUserCapacity(env, meData.id);
      if (userCapacityResponse) {
        return userCapacityResponse;
      }

      const now = Math.floor(Date.now() / 1000);
      const expiresAt = now + expiresIn;

      await env.DB.prepare(
        `INSERT OR REPLACE INTO threads_accounts (threads_user_id, access_token, expires_at)
         VALUES (?, ?, ?)`,
      )
        .bind(meData.id, accessToken, expiresAt)
        .run();

      return Response.redirect(
        "https://lensically-worker.lensically.workers.dev/connect/success",
        302
      );
    }

    if (url.pathname === "/auth/threads/uninstall" && request.method === "POST") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/auth/threads/delete" && request.method === "POST") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/api/threads/me" && request.method === "GET") {
      const account = await env.DB.prepare(
        "SELECT threads_user_id, access_token FROM threads_accounts LIMIT 1",
      ).first<{ threads_user_id: string; access_token: string }>();

      if (!account) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      const meResp = await fetch(
        "https://graph.threads.net/v1.0/me?fields=id,username,threads_profile_picture_url",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const meJson = await meResp.json() as {
        username?: string;
        threads_profile_picture_url?: string;
      };

      return new Response(
        JSON.stringify({
          username: meJson.username ?? null,
          threads_profile_picture_url: meJson.threads_profile_picture_url ?? null,
        }),
        {
          status: meResp.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    }

    if (
      (url.pathname === "/api/threads/profile" || url.pathname === "/api/threads/profile_lookup")
      && request.method === "GET"
    ) {
      const username = url.searchParams.get("username");

      if (!username) {
        return new Response(
          JSON.stringify({ error: "missing username" }),
          { status: 400 },
        );
      }

      const account = await env.DB
        .prepare("SELECT threads_user_id, access_token FROM threads_accounts LIMIT 1")
        .first<{ threads_user_id: string; access_token: string }>();

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          { status: 400 },
        );
      }
      const limitResponse = await runLimitCheck(env, account.threads_user_id, "discovery_calls", 20);
      if (limitResponse) {
        return limitResponse;
      }

      const res = await fetch(
        `https://graph.threads.net/v1.0/profile_lookup?username=${username}`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        },
      );

      const data = await res.json();

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/threads/posts" && request.method === "GET") {
      const cursor = url.searchParams.get("cursor");
      const cursorDepthParam = Number(url.searchParams.get("cursor_depth") || 0);
      const cursorDepth = Number.isFinite(cursorDepthParam) && cursorDepthParam > 0
        ? cursorDepthParam
        : (cursor ? 2 : 1);

      if (cursorDepth > 3) {
        return new Response(
          JSON.stringify({
            posts: [],
            has_more: false,
          }),
          {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }

      const account = await env.DB.prepare(
        "SELECT threads_user_id, access_token FROM threads_accounts LIMIT 1",
      ).first<{ threads_user_id: string; access_token: string }>();

      if (!account) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          },
        );
      }
      const limitResponse = await runLimitCheck(env, account.threads_user_id, "insights_calls", 100);
      if (limitResponse) {
        return new Response(await limitResponse.text(), {
          status: limitResponse.status,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        });
      }

      const params = new URLSearchParams({
        fields:
          "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply",
        limit: "100",
      });
      if (cursor) {
        params.set("after", cursor);
      }

      const postsResp = await fetch(
        `https://graph.threads.net/v1.0/${account.threads_user_id}/threads?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const data = await postsResp.json() as {
        data?: unknown[];
        paging?: {
          next?: string;
          cursors?: {
            after?: string;
          };
        };
      };
      const postsArray = Array.isArray(data.data) ? data.data : [];
      const profileResp = await fetch(
        "https://graph.threads.net/v1.0/me?fields=id,username,name,threads_profile_picture_url",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );
      const profileJson = await profileResp.json() as { threads_profile_picture_url?: string };
      const profilePicture = profileJson?.threads_profile_picture_url ?? null;
      console.log("POST_COUNT", postsArray.length);
      const enrichedPosts = [];
      const batchSize = 10;
      for (let i = 0; i < postsArray.length; i += batchSize) {
        const batch = postsArray.slice(i, i + batchSize);

        const results = await Promise.all(
          batch.map(async (post) => {
            const postId = String((post as { id?: string })?.id ?? "");
            console.log("PROCESSING_POST", postId);
            const basePost = {
              id: (post as { id?: string })?.id,
              text: (post as { text?: string })?.text,
              timestamp: (post as { timestamp?: string })?.timestamp,
              permalink: (post as { permalink?: string })?.permalink,
              username: (post as { username?: string })?.username,
            };

            if (!postId) {
              return {
                ...basePost,
                profile_picture_url: profilePicture,
                views: 0,
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
                shares: 0,
              };
            }

            try {
              const metricsResp = await fetch(
                `https://graph.threads.net/v1.0/${postId}/insights?metric=views,likes,replies,reposts,quotes,shares&access_token=${encodeURIComponent(account.access_token)}`,
              );
              if (!metricsResp.ok) {
                console.log("INSIGHTS_REQUEST_FAILED", {
                  postId,
                  text: basePost.text,
                  status: metricsResp.status,
                });
              }

              const metricsJson = await metricsResp.json() as {
                data?: Array<{
                  name?: string;
                  values?: Array<{ value?: number }>;
                  total_value?: { value?: number };
                  link_total_values?: Array<{ value?: number }>;
                }>;
              };
              console.log("THREADS_INSIGHTS_DEBUG", {
                postId: postId,
                status: metricsResp.status,
                response: metricsJson,
              });

              const metricMap: Record<string, number> = {};

              for (const m of metricsJson.data ?? []) {
                const value =
                  m?.values?.[0]?.value ??
                  m?.total_value?.value ??
                  m?.link_total_values?.[0]?.value ??
                  0;

                if (m?.name) {
                  metricMap[m.name] = Number(value ?? 0);
                }
              }

              return {
                ...basePost,
                profile_picture_url: profilePicture,
                views: metricMap.views ?? 0,
                likes: metricMap.likes ?? 0,
                replies: metricMap.replies ?? 0,
                reposts: metricMap.reposts ?? 0,
                quotes: metricMap.quotes ?? 0,
                shares: metricMap.shares ?? 0,
              };
            } catch {
              return {
                ...basePost,
                profile_picture_url: profilePicture,
                views: 0,
                likes: 0,
                replies: 0,
                reposts: 0,
                quotes: 0,
                shares: 0,
              };
            }
          }),
        );

        enrichedPosts.push(...results);
      }
      const hasMore = Boolean(data.paging?.next) && cursorDepth < 3;
      const nextCursor = cursorDepth < 3 ? (data.paging?.cursors?.after || null) : null;

      return new Response(JSON.stringify({
        posts: enrichedPosts,
        next_cursor: nextCursor,
        has_more: hasMore,
      }), {
        status: postsResp.status,
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-store",
          ...corsHeaders,
        },
      });
    }

    if (url.pathname === "/api/threads/insights" && request.method === "GET") {
      const threadsUserId = url.searchParams.get("threads_user_id");
      const account = threadsUserId
        ? await env.DB.prepare(
            "SELECT access_token FROM threads_accounts WHERE threads_user_id = ?",
          )
            .bind(threadsUserId)
            .first<{ access_token: string }>()
        : null;

      if (!account?.access_token) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const insightsResp = await fetch(
        "https://graph.threads.net/v1.0/me/threads_insights?metric=views,likes,replies,reposts",
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      return new Response(await insightsResp.text(), {
        status: insightsResp.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/post-insights" && request.method === "GET") {
      const mediaId = url.searchParams.get("id");
      if (!mediaId) {
        return new Response(
          JSON.stringify({ error: "missing media id" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await env.DB.prepare(
        "SELECT access_token FROM threads_accounts LIMIT 1",
      ).first<{ access_token: string }>();

      if (!account?.access_token) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const params = new URLSearchParams({
        metric: "views,likes,replies,reposts,quotes,shares",
      });

      const insightsRes = await fetch(
        `https://graph.threads.net/v1.0/${mediaId}/insights?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const data = await insightsRes.json();
      return new Response(JSON.stringify(data), {
        status: insightsRes.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/user-insights" && request.method === "GET") {
      const account = await env.DB.prepare(
        "SELECT threads_user_id, access_token FROM threads_accounts LIMIT 1",
      ).first<{ threads_user_id: string; access_token: string }>();

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const params = new URLSearchParams({
        metric: "views,likes,replies,reposts,quotes,clicks,followers_count",
      });

      const insightsRes = await fetch(
        `https://graph.threads.net/v1.0/${account.threads_user_id}/threads_insights?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${account.access_token}` },
        },
      );

      const data = await insightsRes.json();
      return new Response(JSON.stringify(data), {
        status: insightsRes.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/threads/search" && request.method === "GET") {
      const q = url.searchParams.get("q");
      if (!q) {
        return new Response(
          JSON.stringify({ error: "missing query parameter q" }),
          { status: 400 },
        );
      }

      const searchType = url.searchParams.get("search_type") || "TOP";
      const searchMode = url.searchParams.get("search_mode") || "KEYWORD";
      const mediaType = url.searchParams.get("media_type");
      const limit = url.searchParams.get("limit") || "25";

      const account = await env.DB.prepare(
        "SELECT threads_user_id, access_token FROM threads_accounts LIMIT 1",
      ).first<{ threads_user_id: string; access_token: string }>();

      if (!account) {
        return new Response(
          JSON.stringify({ error: "no connected account" }),
          { status: 400 },
        );
      }
      const limitResponse = await runLimitCheck(env, account.threads_user_id, "keyword_calls", 25);
      if (limitResponse) {
        return limitResponse;
      }

      const params = new URLSearchParams({
        q,
        search_type: searchType,
        search_mode: searchMode,
        limit,
      });

      if (mediaType) {
        params.append("media_type", mediaType);
      }

      params.append(
        "fields",
        "id,text,media_type,permalink,timestamp,username,has_replies,is_quote_post,is_reply",
      );

      const threadsRes = await fetch(
        `https://graph.threads.net/v1.0/keyword_search?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${account.access_token}`,
          },
        },
      );

      const data = await threadsRes.json();

      return new Response(JSON.stringify(data), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/api/threads/publish" && request.method === "POST") {
      let payload: { threads_user_id?: string; text?: string };
      try {
        payload = await request.json();
      } catch {
        return new Response(
          JSON.stringify({ error: "Invalid JSON body" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const threadsUserId = payload.threads_user_id?.trim();
      const text = payload.text?.trim();

      if (!threadsUserId || !text) {
        return new Response(
          JSON.stringify({ error: "threads_user_id and text are required" }),
          {
            status: 400,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }

      const account = await env.DB.prepare(
        "SELECT access_token FROM threads_accounts WHERE threads_user_id = ?",
      )
        .bind(threadsUserId)
        .first<{ access_token: string }>();

      if (!account?.access_token) {
        return new Response(
          JSON.stringify({ error: "Threads account not connected" }),
          {
            status: 404,
            headers: { "content-type": "application/json; charset=UTF-8" },
          },
        );
      }
      const limitResponse = await runLimitCheck(env, threadsUserId, "publish_calls", 50);
      if (limitResponse) {
        return limitResponse;
      }

      const publishBody = new URLSearchParams({
        text,
        media_type: "TEXT"
      });
      const publishResp = await fetch("https://graph.threads.net/v1.0/me/threads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${account.access_token}`,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: publishBody,
      });

      return new Response(await publishResp.text(), {
        status: publishResp.status,
        headers: { "content-type": "application/json; charset=UTF-8" },
      });
    }

    if (url.pathname === "/api/accounts" && request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT threads_user_id, created_at
         FROM threads_accounts
         ORDER BY created_at DESC`,
      ).all<{ threads_user_id: string; created_at: number }>();

      return new Response(
        JSON.stringify({ accounts: result.results ?? [] }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    if (url.pathname === "/internal/refresh-tokens" && request.method === "POST") {
      const key = request.headers.get("x-internal-key");
      if (key !== env.INTERNAL_API_KEY) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "content-type": "application/json" } }
        );
      }

      const rows = await env.DB.prepare(
        `SELECT threads_user_id, access_token, expires_at
         FROM threads_accounts`,
      ).all<{ threads_user_id: string; access_token: string; expires_at: number }>();

      const now = Math.floor(Date.now() / 1000);
      const refreshThreshold = now + (7 * 24 * 60 * 60);
      let refreshed = 0;

      for (const row of rows.results ?? []) {
        if (!row.access_token || !row.threads_user_id || !row.expires_at) {
          continue;
        }
        if (row.expires_at >= refreshThreshold) {
          continue;
        }

        const refreshResp = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${encodeURIComponent(row.access_token)}`,
        );
        if (!refreshResp.ok) {
          continue;
        }

        const refreshData = await refreshResp.json() as {
          access_token?: string;
          expires_in?: number;
        };
        const newAccessToken = refreshData.access_token;
        const expiresIn = Number(refreshData.expires_in ?? 0);
        if (!newAccessToken || !expiresIn) {
          continue;
        }

        const newExpiresAt = now + expiresIn;
        await env.DB.prepare(
          `UPDATE threads_accounts
           SET access_token = ?, expires_at = ?
           WHERE threads_user_id = ?`,
        )
          .bind(newAccessToken, newExpiresAt, row.threads_user_id)
          .run();
        refreshed += 1;
      }

      return new Response(
        JSON.stringify({ refreshed }),
        {
          status: 200,
          headers: { "content-type": "application/json; charset=UTF-8" },
        },
      );
    }

    return new Response("Lensically Worker Running", {
      status: 200,
      headers: { "content-type": "text/plain; charset=UTF-8" },
    });
  },
  async scheduled(event, env, ctx) {
    const now = Math.floor(Date.now() / 1000);
    const threshold = now + (7 * 24 * 60 * 60);

    const rows = await env.DB
      .prepare(
        "SELECT threads_user_id, access_token FROM threads_accounts WHERE expires_at <= ?",
      )
      .bind(threshold)
      .all();

    for (const row of rows.results) {
      try {
        const refresh = await fetch(
          `https://graph.threads.net/refresh_access_token?grant_type=th_refresh_token&access_token=${row.access_token}`,
        );

        if (!refresh.ok) {
          console.log("refresh failed", row.threads_user_id);
          continue;
        }

        const data: any = await refresh.json();
        const newToken = data.access_token;
        const expiresAt = now + data.expires_in;

        await env.DB.prepare(
          "UPDATE threads_accounts SET access_token = ?, expires_at = ? WHERE threads_user_id = ?",
        )
          .bind(newToken, expiresAt, row.threads_user_id)
          .run();

        console.log("token refreshed", row.threads_user_id);
      } catch (err) {
        console.log("refresh error", err);
      }
    }
  },
} satisfies ExportedHandler<Env>;
