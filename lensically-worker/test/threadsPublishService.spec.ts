import { afterEach, describe, expect, it, vi } from "vitest";
import { publishTextToThreads } from "../src/utils/threadsPublishService";

describe("Threads publish readiness", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("waits for FINISHED before making exactly one publish commit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "IN_PROGRESS" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "FINISHED" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "post-1" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishTextToThreads({
      accessToken: "token",
      threadsUserId: "user-1",
      text: "Ready before publish.",
      readinessMaxChecks: 3,
      readinessDelayMs: 0,
    });

    expect(result).toMatchObject({
      success: true,
      publishRequestId: "container-1",
      publishedPostId: "post-1",
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls[0]).toContain("/user-1/threads");
    expect(urls[1]).toContain("/container-1?fields=status,error_message");
    expect(urls[2]).toContain("/container-1?fields=status,error_message");
    expect(urls.filter((url) => url.includes("/threads_publish"))).toHaveLength(1);
  });

  it("does not call the publish endpoint when readiness never completes", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "container-2" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "IN_PROGRESS" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ status: "PROCESSING" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await publishTextToThreads({
      accessToken: "token",
      threadsUserId: "user-2",
      text: "Do not commit early.",
      readinessMaxChecks: 2,
      readinessDelayMs: 0,
    });

    expect(result).toMatchObject({
      success: false,
      errorCode: "threads_publish_status_not_ready",
    });
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.filter((url) => url.includes("/threads_publish"))).toHaveLength(0);
  });
});
