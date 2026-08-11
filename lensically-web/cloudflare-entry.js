import openNextWorker from "./.open-next/worker.js";
export * from "./.open-next/worker.js";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const forwardedProto = request.headers.get("x-forwarded-proto");
    const scheme = (forwardedProto || url.protocol.replace(":", "")).toLowerCase();

    if (scheme !== "https") {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 308);
    }

    const response = await openNextWorker.fetch(request, env, ctx);
    const headers = new Headers(response.headers);
    headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
