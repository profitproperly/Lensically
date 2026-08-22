# Lensically v2 Zero-Legacy Retirement Extract

Generated: 2026-08-22T07:13:26.147Z

Web-used API routes: 31

## /api/batch-schedule/presets

Web refs: lensically-web/app/(internal)/schedule/page.tsx:47, lensically-web/components/BatchSchedulePanel.tsx:49

### Worker occurrence line 34225

```ts
34180:           status: 400,
34181:           headers: { "Content-Type": "application/json" },
34182:         });
34183:       }
34184: 
34185:       try {
34186:         const accountId = await resolvePatternAccountId(
34187:           env,
34188:           typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
34189:           typeof payload.account_id === "string" ? payload.account_id : null,
34190:         );
34191:         const pattern = await updateExternalPatternText(
34192:           env,
34193:           appUserId,
34194:           accountId,
34195:           Number(payload.id),
34196:           typeof payload.post_text === "string" ? payload.post_text : "",
34197:         );
34198: 
34199:         if (!pattern) {
34200:           return new Response(JSON.stringify({ error: "pattern_not_found" }), {
34201:             status: 404,
34202:             headers: { "Content-Type": "application/json" },
34203:           });
34204:         }
34205: 
34206:         return new Response(JSON.stringify({
34207:           success: true,
34208:           app_user_id: appUserId,
34209:           account_id: accountId,
34210:           pattern,
34211:         }), {
34212:           status: 200,
34213:           headers: { "Content-Type": "application/json" },
34214:         });
34215:       } catch (error) {
34216:         const message = getErrorMessage(error);
34217:         const status = message === "post_text_is_required" || message === "pattern_id_is_required" ? 400 : 500;
34218:         return new Response(JSON.stringify({ error: message }), {
34219:           status,
34220:           headers: { "Content-Type": "application/json" },
34221:         });
34222:       }
34223:     }
34224: 
34225:     if (normalizedPath === "/api/batch-schedule/presets" && request.method === "GET") {
34226:       const authUser = await requireAuth(request, env);
34227:       if (authUser instanceof Response) {
34228:         return applyAuthCors(authUser);
34229:       }
34230: 
34231:       const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
34232:       const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId || null);
34233:       if (!threadsUserId || !account?.threads_user_id || account.threads_user_id !== threadsUserId) {
34234:         return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
34235:           status: 400,
34236:           headers: { "Content-Type": "application/json" },
34237:         }));
34238:       }
34239: 
34240:       const presets = await listBatchSchedulePresetsForUser(env, authUser.id, threadsUserId);
34241:       return applyAuthCors(new Response(JSON.stringify({
34242:         success: true,
34243:         presets,
34244:       }), {
34245:         status: 200,
34246:         headers: { "Content-Type": "application/json" },
34247:       }));
34248:     }
34249: 
34250:     if ((normalizedPath === "/internal/batch-schedule/presets" || normalizedPath === "/api/internal/batch-schedule/presets") && request.method === "GET") {
34251:       if (!isInternalRequestAuthorized(request, env)) {
34252:         return new Response(
34253:           JSON.stringify({ error: "Unauthorized" }),
34254:           { status: 401, headers: { "content-type": "application/json; charset=UTF-8" } },
34255:         );
34256:       }
34257: 
34258:       const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
34259:       const presets = threadsUserId
34260:         ? await listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, threadsUserId)
34261:         : [];
34262:       return new Response(JSON.stringify({
34263:         success: true,
34264:         presets,
34265:       }), {
34266:         status: 200,
34267:         headers: { "Content-Type": "application/json" },
34268:       });
34269:     }
34270: 
```

### Worker occurrence line 34271

```ts
34226:       const authUser = await requireAuth(request, env);
34227:       if (authUser instanceof Response) {
34228:         return applyAuthCors(authUser);
34229:       }
34230: 
34231:       const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
34232:       const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId || null);
34233:       if (!threadsUserId || !account?.threads_user_id || account.threads_user_id !== threadsUserId) {
34234:         return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
34235:           status: 400,
34236:           headers: { "Content-Type": "application/json" },
34237:         }));
34238:       }
34239: 
34240:       const presets = await listBatchSchedulePresetsForUser(env, authUser.id, threadsUserId);
34241:       return applyAuthCors(new Response(JSON.stringify({
34242:         success: true,
34243:         presets,
34244:       }), {
34245:         status: 200,
34246:         headers: { "Content-Type": "application/json" },
34247:       }));
34248:     }
34249: 
34250:     if ((normalizedPath === "/internal/batch-schedule/presets" || normalizedPath === "/api/internal/batch-schedule/presets") && request.method === "GET") {
34251:       if (!isInternalRequestAuthorized(request, env)) {
34252:         return new Response(
34253:           JSON.stringify({ error: "Unauthorized" }),
34254:           { status: 401, headers: { "content-type": "application/json; charset=UTF-8" } },
34255:         );
34256:       }
34257: 
34258:       const threadsUserId = url.searchParams.get("threads_user_id")?.trim() || "";
34259:       const presets = threadsUserId
34260:         ? await listBatchSchedulePresetsForUser(env, WORKSPACE_APP_USER_ID, threadsUserId)
34261:         : [];
34262:       return new Response(JSON.stringify({
34263:         success: true,
34264:         presets,
34265:       }), {
34266:         status: 200,
34267:         headers: { "Content-Type": "application/json" },
34268:       });
34269:     }
34270: 
34271:     if (normalizedPath === "/api/batch-schedule/presets" && request.method === "POST") {
34272:       const authUser = await requireAuth(request, env);
34273:       if (authUser instanceof Response) {
34274:         return applyAuthCors(authUser);
34275:       }
34276: 
34277:       let payload: {
34278:         name?: string;
34279:         times?: unknown;
34280:         is_favorite?: boolean;
34281:         threads_user_id?: string;
34282:       };
34283:       try {
34284:         payload = await request.json();
34285:       } catch {
34286:         return applyAuthCors(new Response(JSON.stringify({ error: "Invalid JSON body" }), {
34287:           status: 400,
34288:           headers: { "Content-Type": "application/json" },
34289:         }));
34290:       }
34291: 
34292:       const name = normalizeBatchSchedulePresetName(payload.name);
34293:       const times = normalizeBatchSchedulePresetTimes(payload.times);
34294:       const threadsUserId = payload.threads_user_id?.trim() ?? "";
34295:       if (!name || !times || !threadsUserId) {
34296:         return applyAuthCors(new Response(JSON.stringify({
34297:           error: "threads_user_id, name, and a valid ordered times array are required",
34298:         }), {
34299:           status: 400,
34300:           headers: { "Content-Type": "application/json" },
34301:         }));
34302:       }
34303: 
34304:       const account = await getThreadsAccountForAppUser(env, authUser.id, threadsUserId);
34305:       if (!account?.threads_user_id || account.threads_user_id !== threadsUserId) {
34306:         return applyAuthCors(new Response(JSON.stringify({ error: "Threads account not connected" }), {
34307:           status: 400,
34308:           headers: { "Content-Type": "application/json" },
34309:         }));
34310:       }
34311: 
34312:       await ensureWorkspaceUserRecord(env, {
34313:         id: authUser.id,
34314:         email: authUser.email ?? "workspace@lensically.local",
34315:         timezone: authUser.timezone ?? WORKSPACE_DEFAULT_TIMEZONE,
34316:         clock_format: authUser.clock_format ?? "12h",
```

## /api/cycles/history

Web refs: lensically-web/app/(internal)/cycles/page.tsx:199

### Worker occurrence line 34938

```ts
34893:           accounts: linkedAccountsPayload,
34894:           active_threads_user_id: activeThreadsUserId,
34895:           ...accountPayload,
34896:         }),
34897:         {
34898:           status: meResp.status,
34899:           headers: {
34900:             "Content-Type": "application/json",
34901:             ...requestCorsHeaders,
34902:           },
34903:         },
34904:       );
34905:     }
34906: 
34907:             if (url.pathname === "/api/threads/intelligence-dashboard") {
34908:       return new Response(JSON.stringify({
34909:         success: false,
34910:         error: "intelligence_dashboard_retired",
34911:         intelligence_backend_active: true,
34912:       }), {
34913:         status: 410,
34914:         headers: {
34915:           "Content-Type": "application/json",
34916:           "Cache-Control": "no-store",
34917:           ...requestCorsHeaders,
34918:         },
34919:       });
34920:     }
34921: 
34922:                 if (url.pathname === "/api/signal-radar/overview" && request.method === "GET") {
34923:           const requestedLimit = Number(url.searchParams.get("limit") ?? "60");
34924:           const overview = await readSignalRadarOverview(env.DB, requestedLimit);
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
34983:             },
```

## /api/cycles/selection-detail

Web refs: lensically-web/app/(internal)/cycles/page.tsx:202

### Worker occurrence line 34941

```ts
34896:         }),
34897:         {
34898:           status: meResp.status,
34899:           headers: {
34900:             "Content-Type": "application/json",
34901:             ...requestCorsHeaders,
34902:           },
34903:         },
34904:       );
34905:     }
34906: 
34907:             if (url.pathname === "/api/threads/intelligence-dashboard") {
34908:       return new Response(JSON.stringify({
34909:         success: false,
34910:         error: "intelligence_dashboard_retired",
34911:         intelligence_backend_active: true,
34912:       }), {
34913:         status: 410,
34914:         headers: {
34915:           "Content-Type": "application/json",
34916:           "Cache-Control": "no-store",
34917:           ...requestCorsHeaders,
34918:         },
34919:       });
34920:     }
34921: 
34922:                 if (url.pathname === "/api/signal-radar/overview" && request.method === "GET") {
34923:           const requestedLimit = Number(url.searchParams.get("limit") ?? "60");
34924:           const overview = await readSignalRadarOverview(env.DB, requestedLimit);
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
34983:             },
34984:           },
34985:         );
34986:       }
```

## /api/cycles/selections

Web refs: lensically-web/app/(internal)/cycles/page.tsx:201

### Worker occurrence line 34940

```ts
34895:           ...accountPayload,
34896:         }),
34897:         {
34898:           status: meResp.status,
34899:           headers: {
34900:             "Content-Type": "application/json",
34901:             ...requestCorsHeaders,
34902:           },
34903:         },
34904:       );
34905:     }
34906: 
34907:             if (url.pathname === "/api/threads/intelligence-dashboard") {
34908:       return new Response(JSON.stringify({
34909:         success: false,
34910:         error: "intelligence_dashboard_retired",
34911:         intelligence_backend_active: true,
34912:       }), {
34913:         status: 410,
34914:         headers: {
34915:           "Content-Type": "application/json",
34916:           "Cache-Control": "no-store",
34917:           ...requestCorsHeaders,
34918:         },
34919:       });
34920:     }
34921: 
34922:                 if (url.pathname === "/api/signal-radar/overview" && request.method === "GET") {
34923:           const requestedLimit = Number(url.searchParams.get("limit") ?? "60");
34924:           const overview = await readSignalRadarOverview(env.DB, requestedLimit);
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
34983:             },
34984:           },
34985:         );
```

## /api/cycles/state

Web refs: lensically-web/app/(internal)/cycles/page.tsx:198

### Worker occurrence line 34937

```ts
34892:           account: accountPayload,
34893:           accounts: linkedAccountsPayload,
34894:           active_threads_user_id: activeThreadsUserId,
34895:           ...accountPayload,
34896:         }),
34897:         {
34898:           status: meResp.status,
34899:           headers: {
34900:             "Content-Type": "application/json",
34901:             ...requestCorsHeaders,
34902:           },
34903:         },
34904:       );
34905:     }
34906: 
34907:             if (url.pathname === "/api/threads/intelligence-dashboard") {
34908:       return new Response(JSON.stringify({
34909:         success: false,
34910:         error: "intelligence_dashboard_retired",
34911:         intelligence_backend_active: true,
34912:       }), {
34913:         status: 410,
34914:         headers: {
34915:           "Content-Type": "application/json",
34916:           "Cache-Control": "no-store",
34917:           ...requestCorsHeaders,
34918:         },
34919:       });
34920:     }
34921: 
34922:                 if (url.pathname === "/api/signal-radar/overview" && request.method === "GET") {
34923:           const requestedLimit = Number(url.searchParams.get("limit") ?? "60");
34924:           const overview = await readSignalRadarOverview(env.DB, requestedLimit);
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
```

## /api/cycles/summary

Web refs: lensically-web/app/(internal)/cycles/page.tsx:200

### Worker occurrence line 34939

```ts
34894:           active_threads_user_id: activeThreadsUserId,
34895:           ...accountPayload,
34896:         }),
34897:         {
34898:           status: meResp.status,
34899:           headers: {
34900:             "Content-Type": "application/json",
34901:             ...requestCorsHeaders,
34902:           },
34903:         },
34904:       );
34905:     }
34906: 
34907:             if (url.pathname === "/api/threads/intelligence-dashboard") {
34908:       return new Response(JSON.stringify({
34909:         success: false,
34910:         error: "intelligence_dashboard_retired",
34911:         intelligence_backend_active: true,
34912:       }), {
34913:         status: 410,
34914:         headers: {
34915:           "Content-Type": "application/json",
34916:           "Cache-Control": "no-store",
34917:           ...requestCorsHeaders,
34918:         },
34919:       });
34920:     }
34921: 
34922:                 if (url.pathname === "/api/signal-radar/overview" && request.method === "GET") {
34923:           const requestedLimit = Number(url.searchParams.get("limit") ?? "60");
34924:           const overview = await readSignalRadarOverview(env.DB, requestedLimit);
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
34983:             },
34984:           },
```

## /api/gpt-memory/saved-patterns/review

Web refs: lensically-web/app/(internal)/saved-patterns/page.tsx:93

## /api/hermes/generate-posts

Web refs: lensically-web/app/(internal)/schedule/page.tsx:46

### Worker occurrence line 35855

```ts
35810:           results.push({
35811:             row_number: index + 1,
35812:             success: false,
35813:             reused: false,
35814:             scheduled_post_id: null,
35815:             scheduled_time_utc: null,
35816:             error: "missing_required_fields",
35817:           });
35818:           continue;
35819:         }
35820: 
35821:         const scheduled = await createScheduledPostForAppUser(
35822:           env,
35823:           ownedAppUserId,
35824:           threadsUserId,
35825:           text,
35826:           date,
35827:           time,
35828:           timezone,
35829:           spoilerAllText,
35830:           spoilerPhrases,
35831:         );
35832: 
35833:         results.push({
35834:           row_number: index + 1,
35835:           success: scheduled.success,
35836:           reused: scheduled.reused === true,
35837:           scheduled_post_id: scheduled.scheduledPostId ?? null,
35838:           scheduled_time_utc: scheduled.scheduledTimeUtc ?? null,
35839:           error: scheduled.success ? null : scheduled.error ?? "schedule_failed",
35840:         });
35841:       }
35842: 
35843:       return new Response(
35844:         JSON.stringify({
35845:           success: true,
35846:           results,
35847:         }),
35848:         {
35849:           status: 200,
35850:           headers: { "content-type": "application/json; charset=UTF-8" },
35851:         },
35852:       );
35853:     }
35854: 
35855:     if (url.pathname === "/api/hermes/generate-posts" && request.method === "POST") {
35856:       const authUser = await requireAuth(request, env);
35857:       if (authUser instanceof Response) {
35858:         return authUser;
35859:       }
35860: 
35861:       let payload: {
35862:         threads_user_id?: string;
35863:         count?: unknown;
35864:         topic?: string;
35865:       };
35866:       try {
35867:         payload = await request.json();
35868:       } catch {
35869:         return new Response(
35870:           JSON.stringify({ error: "Invalid JSON body" }),
35871:           {
35872:             status: 400,
35873:             headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
35874:           },
35875:         );
35876:       }
35877: 
35878:       const threadsUserId = payload.threads_user_id?.trim();
35879:       const count = normalizeHermesPostCount(payload.count);
35880:       const topic = payload.topic?.trim() || null;
35881:       if (!threadsUserId) {
35882:         return new Response(
35883:           JSON.stringify({ error: "threads_user_id is required" }),
35884:           {
35885:             status: 400,
35886:             headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
35887:           },
35888:         );
35889:       }
35890: 
35891:       const ownedAppUserId = authUser.id || WORKSPACE_APP_USER_ID;
35892:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, threadsUserId);
35893:       const directThreadsAccount = account?.threads_user_id === threadsUserId
35894:         ? account
35895:         : await env.DB.prepare(
35896:           `SELECT threads_user_id
35897:            FROM threads_accounts
35898:            WHERE threads_user_id = ?
35899:            LIMIT 1`,
35900:         )
```

## /api/patterns/delete

Web refs: lensically-web/app/(internal)/saved-patterns/page.tsx:89

### Worker occurrence line 34113

```ts
34068:         env,
34069:         threadsUserId,
34070:         typeof payload.account_id === "string" ? payload.account_id : null,
34071:       );
34072:       const ownedPattern = await env.DB.prepare(
34073:         `SELECT id FROM external_patterns
34074:          WHERE id = ? AND app_user_id = ? AND account_id = ? LIMIT 1`,
34075:       ).bind(patternId, appUserId, accountId).first<{ id: number | string }>();
34076:       if (!ownedPattern) {
34077:         return new Response(JSON.stringify({ error: "saved_pattern_not_found" }), {
34078:           status: 404,
34079:           headers: { "Content-Type": "application/json" },
34080:         });
34081:       }
34082:       await ensureOwnerEditLearningTables(env);
34083:       const sourceCard = await resolveSavedPatternSourceCard(env.DB, { accountId, patternId });
34084:       if (!sourceCard?.id || !sourceCard.brand_key) {
34085:         return new Response(JSON.stringify({ error: "linked_source_card_not_found" }), {
34086:           status: 404,
34087:           headers: { "Content-Type": "application/json" },
34088:         });
34089:       }
34090:       try {
34091:         const guidance = await saveSourceCardOwnerGuidance(env.DB, {
34092:           brandKey: String(sourceCard.brand_key),
34093:           accountId,
34094:           threadsUserId,
34095:           sourceCardId: String(sourceCard.id),
34096:           guidanceText: payload.guidance_text,
34097:           active: payload.active !== false,
34098:         });
34099:         const refreshed = await resolveSavedPatternSourceCard(env.DB, { accountId, patternId });
34100:         return new Response(JSON.stringify({ success: true, guidance, source_card: refreshed }), {
34101:           status: 200,
34102:           headers: { "Content-Type": "application/json" },
34103:         });
34104:       } catch (error) {
34105:         const message = getErrorMessage(error);
34106:         return new Response(JSON.stringify({ error: message }), {
34107:           status: message === "guidance_text_required" ? 400 : 500,
34108:           headers: { "Content-Type": "application/json" },
34109:         });
34110:       }
34111:     }
34112: 
34113:     if (normalizedPath === "/api/patterns/delete" && request.method === "POST") {
34114:       let payload: {
34115:         app_user_id?: unknown;
34116:         account_id?: unknown;
34117:         threads_user_id?: unknown;
34118:         ids?: unknown;
34119:       };
34120:       try {
34121:         payload = await request.json();
34122:       } catch {
34123:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
34124:           status: 400,
34125:           headers: { "Content-Type": "application/json" },
34126:         });
34127:       }
34128: 
34129:       const appUserId = normalizeAppUserId(
34130:         typeof payload.app_user_id === "string" ? payload.app_user_id : null,
34131:       );
34132:       if (!appUserId) {
34133:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
34134:           status: 400,
34135:           headers: { "Content-Type": "application/json" },
34136:         });
34137:       }
34138: 
34139:       const ids = Array.isArray(payload.ids) ? payload.ids.map((value) => Number(value)) : [];
34140:       const accountId = await resolvePatternAccountId(
34141:         env,
34142:         typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
34143:         typeof payload.account_id === "string" ? payload.account_id : null,
34144:       );
34145:       const deleted = await deleteExternalPatterns(env, appUserId, accountId, ids);
34146: 
34147:       return new Response(JSON.stringify({
34148:         success: true,
34149:         app_user_id: appUserId,
34150:         account_id: accountId,
34151:         deleted,
34152:       }), {
34153:         status: 200,
34154:         headers: { "Content-Type": "application/json" },
34155:       });
34156:     }
34157: 
34158:     if (normalizedPath === "/api/patterns/update" && request.method === "POST") {
```

## /api/patterns/import

Web refs: lensically-web/app/mobile-save/page.tsx:9

### Worker occurrence line 33484

```ts
33439: 
33440: 
33441:     if (normalizedPath.startsWith("/api/operator/local-node/")) {
33442:       logWorkerEvent("RETIRED_ROUTE_BLOCKED", {
33443:         path: normalizedPath,
33444:         method: request.method,
33445:         reason_code: "local_execution_plane_retired",
33446:       });
33447:       return notFoundJsonResponse(requestCorsHeaders);
33448:     }
33449: 
33450:     if (normalizedPath.startsWith("/api/operator/tools/")) {
33451:       const toolName = normalizedPath.slice("/api/operator/tools/".length).replace(/\/+$/, "");
33452:       if (!toolName) {
33453:         return operatorJsonResponse({ success: false, error: "operator tool name is required" }, 400);
33454:       }
33455:       if (request.method !== "GET" && request.method !== "POST") {
33456:         return operatorJsonResponse({ success: false, error: "Method not allowed" }, 405);
33457:       }
33458:       return handleOperatorTool(request, env, toolName);
33459:     }
33460: 
33461:     if (normalizedPath === "/api/operator/mcp") {
33462:       const requestId = request.headers.get("cf-ray") || crypto.randomUUID();
33463:       try {
33464:         return await handleOperatorMcp(request, env);
33465:       } catch (error) {
33466:         return operatorTransportFailure(env, requestId, "mcp_transport", error);
33467:       }
33468:     }
33469: 
33470:     if (normalizedPath.startsWith("/api/gpt/")) {
33471:       return new Response(JSON.stringify({ success: false, error: "legacy_gpt_api_retired", replacement: "Lensically Operator Mode direct typed tools", human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT }), {
33472:         status: 410,
33473:         headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
33474:       });
33475:     }
33476: 
33477:     if (normalizedPath.startsWith("/api/gpt-memory/")) {
33478:       return new Response(JSON.stringify({ success: false, error: "gpt_memory_retired", human_free_autonomy: HUMAN_FREE_AUTONOMY_CONTRACT }), {
33479:         status: 410,
33480:         headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
33481:       });
33482:     }
33483: 
33484:     if (normalizedPath === "/api/patterns/import" && request.method === "POST") {
33485:       let payload: Record<string, unknown>;
33486:       try {
33487:         payload = await request.json();
33488:       } catch {
33489:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
33490:           status: 400,
33491:           headers: { "Content-Type": "application/json" },
33492:         });
33493:       }
33494: 
33495:       const appUserId = normalizeAppUserId(
33496:         typeof payload.app_user_id === "string" ? payload.app_user_id : null,
33497:       );
33498:       if (!appUserId) {
33499:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
33500:           status: 400,
33501:           headers: { "Content-Type": "application/json" },
33502:         });
33503:       }
33504: 
33505:       try {
33506:         const accountId = await resolvePatternAccountId(
33507:           env,
33508:           typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
33509:           typeof payload.account_id === "string" ? payload.account_id : null,
33510:         );
33511:         const imported = await importExternalPattern(env, appUserId, accountId, payload);
33512:         return new Response(JSON.stringify({
33513:           success: true,
33514:           app_user_id: appUserId,
33515:           account_id: accountId,
33516:           updated_at: imported.updated_at,
33517:           pattern: imported,
33518:         }), {
33519:           status: 200,
33520:           headers: { "Content-Type": "application/json" },
33521:         });
33522:       } catch (error) {
33523:         const message = getErrorMessage(error);
33524:         const status = message === "source_url and post_text are required" ? 400 : 500;
33525:         return new Response(JSON.stringify({ error: message }), {
33526:           status,
33527:           headers: { "Content-Type": "application/json" },
33528:         });
33529:       }
```

## /api/patterns/list

Web refs: lensically-web/app/(internal)/saved-patterns/page.tsx:88

### Worker occurrence line 33532

```ts
33487:         payload = await request.json();
33488:       } catch {
33489:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
33490:           status: 400,
33491:           headers: { "Content-Type": "application/json" },
33492:         });
33493:       }
33494: 
33495:       const appUserId = normalizeAppUserId(
33496:         typeof payload.app_user_id === "string" ? payload.app_user_id : null,
33497:       );
33498:       if (!appUserId) {
33499:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
33500:           status: 400,
33501:           headers: { "Content-Type": "application/json" },
33502:         });
33503:       }
33504: 
33505:       try {
33506:         const accountId = await resolvePatternAccountId(
33507:           env,
33508:           typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
33509:           typeof payload.account_id === "string" ? payload.account_id : null,
33510:         );
33511:         const imported = await importExternalPattern(env, appUserId, accountId, payload);
33512:         return new Response(JSON.stringify({
33513:           success: true,
33514:           app_user_id: appUserId,
33515:           account_id: accountId,
33516:           updated_at: imported.updated_at,
33517:           pattern: imported,
33518:         }), {
33519:           status: 200,
33520:           headers: { "Content-Type": "application/json" },
33521:         });
33522:       } catch (error) {
33523:         const message = getErrorMessage(error);
33524:         const status = message === "source_url and post_text are required" ? 400 : 500;
33525:         return new Response(JSON.stringify({ error: message }), {
33526:           status,
33527:           headers: { "Content-Type": "application/json" },
33528:         });
33529:       }
33530:     }
33531: 
33532:     if (normalizedPath === "/api/patterns/list" && request.method === "GET") {
33533:       const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
33534:       if (!appUserId) {
33535:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
33536:           status: 400,
33537:           headers: { "Content-Type": "application/json" },
33538:         });
33539:       }
33540: 
33541:       const rawLimit = Number(url.searchParams.get("limit") ?? "50");
33542:       const limit = Number.isFinite(rawLimit) && rawLimit > 0
33543:         ? Math.min(Math.floor(rawLimit), 200)
33544:         : 50;
33545:       const rawPage = Number(url.searchParams.get("page") ?? "1");
33546:       const page = Number.isFinite(rawPage) && rawPage > 0
33547:         ? Math.max(1, Math.floor(rawPage))
33548:         : 1;
33549:       const offset = (page - 1) * limit;
33550:       const requestedOrder = String(url.searchParams.get("order") ?? "newest").trim().toLowerCase();
33551:       const order = requestedOrder === "likes" ? "likes" : "newest";
33552:       const accountId = await resolvePatternAccountId(
33553:         env,
33554:         url.searchParams.get("threads_user_id"),
33555:         url.searchParams.get("account_id"),
33556:       );
33557: 
33558:       await ensureExternalPatternsTable(env);
33559:       const listSql = order === "likes"
33560:         ? `SELECT id, app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
33561:                   post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
33562:                   raw_payload, saved_at, updated_at
33563:            FROM external_patterns
33564:            WHERE app_user_id = ? AND account_id = ?
33565:            ORDER BY likes DESC, COALESCE(views, 0) DESC, datetime(updated_at) DESC, id DESC
33566:            LIMIT ? OFFSET ?`
33567:         : `SELECT id, app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
33568:                   post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
33569:                   raw_payload, saved_at, updated_at
33570:            FROM external_patterns
33571:            WHERE app_user_id = ? AND account_id = ?
33572:            ORDER BY datetime(updated_at) DESC, id DESC
33573:            LIMIT ? OFFSET ?`;
33574:       const rows = await env.DB.prepare(listSql)
33575:         .bind(appUserId, accountId, limit, offset)
33576:         .all<ExternalPatternRow>();
33577: 
```

## /api/patterns/source-card

Web refs: lensically-web/app/(internal)/saved-patterns/page.tsx:90

### Worker occurrence line 34004

```ts
33959:       }
33960:       const accountId = await resolvePatternAccountId(
33961:         env,
33962:         threadsUserId,
33963:         typeof payload.account_id === "string" ? payload.account_id : null,
33964:       );
33965:       const brandKey = getBrandKeyForAccountId(accountId);
33966:       if (!brandKey) {
33967:         return new Response(JSON.stringify({ error: "source_card_account_not_configured" }), {
33968:           status: 404,
33969:           headers: { "Content-Type": "application/json" },
33970:         });
33971:       }
33972:       const ownedCard = await env.DB.prepare(
33973:         `SELECT id FROM operator_source_cards WHERE id = ? AND brand_key = ? LIMIT 1`,
33974:       ).bind(sourceCardId, brandKey).first<{ id: string }>();
33975:       if (!ownedCard) {
33976:         return new Response(JSON.stringify({ error: "source_card_not_found" }), {
33977:           status: 404,
33978:           headers: { "Content-Type": "application/json" },
33979:         });
33980:       }
33981:       await ensureOwnerEditLearningTables(env);
33982:       try {
33983:         const guidance = await saveSourceCardOwnerGuidance(env.DB, {
33984:           brandKey,
33985:           accountId,
33986:           threadsUserId,
33987:           sourceCardId,
33988:           guidanceText: payload.guidance_text,
33989:           active: payload.active !== false,
33990:         });
33991:         return new Response(JSON.stringify({ success: true, guidance }), {
33992:           status: 200,
33993:           headers: { "Content-Type": "application/json" },
33994:         });
33995:       } catch (error) {
33996:         const message = getErrorMessage(error);
33997:         return new Response(JSON.stringify({ error: message }), {
33998:           status: message === "guidance_text_required" ? 400 : 500,
33999:           headers: { "Content-Type": "application/json" },
34000:         });
34001:       }
34002:     }
34003: 
34004:         if (normalizedPath === "/api/patterns/source-card" && request.method === "GET") {
34005: 
34006:       const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
34007:       const patternId = Math.trunc(Number(url.searchParams.get("saved_pattern_id") ?? 0));
34008:       if (!appUserId || !Number.isInteger(patternId) || patternId <= 0) {
34009:         return new Response(JSON.stringify({ error: "app_user_id and saved_pattern_id are required" }), {
34010:           status: 400,
34011:           headers: { "Content-Type": "application/json" },
34012:         });
34013:       }
34014:       const accountId = await resolvePatternAccountId(
34015:         env,
34016:         url.searchParams.get("threads_user_id"),
34017:         url.searchParams.get("account_id"),
34018:       );
34019:       const ownedPattern = await env.DB.prepare(
34020:         `SELECT id FROM external_patterns
34021:          WHERE id = ? AND app_user_id = ? AND account_id = ? LIMIT 1`,
34022:       ).bind(patternId, appUserId, accountId).first<{ id: number | string }>();
34023:       if (!ownedPattern) {
34024:         return new Response(JSON.stringify({ error: "saved_pattern_not_found" }), {
34025:           status: 404,
34026:           headers: { "Content-Type": "application/json" },
34027:         });
34028:       }
34029:       await ensureOwnerEditLearningTables(env);
34030:       const sourceCard = await resolveSavedPatternSourceCard(env.DB, { accountId, patternId });
34031:       return new Response(JSON.stringify({
34032:         success: true,
34033:         saved_pattern_id: patternId,
34034:         source_card: sourceCard,
34035:       }), {
34036:         status: 200,
34037:         headers: { "Content-Type": "application/json" },
34038:       });
34039:     }
34040: 
34041:     if (normalizedPath === "/api/patterns/source-card/guidance" && request.method === "POST") {
34042:       let payload: {
34043:         app_user_id?: unknown;
34044:         account_id?: unknown;
34045:         threads_user_id?: unknown;
34046:         saved_pattern_id?: unknown;
34047:         guidance_text?: unknown;
34048:         active?: unknown;
34049:       };
```

## /api/patterns/source-card/guidance

Web refs: lensically-web/app/(internal)/saved-patterns/page.tsx:91

### Worker occurrence line 34041

```ts
33996:         const message = getErrorMessage(error);
33997:         return new Response(JSON.stringify({ error: message }), {
33998:           status: message === "guidance_text_required" ? 400 : 500,
33999:           headers: { "Content-Type": "application/json" },
34000:         });
34001:       }
34002:     }
34003: 
34004:         if (normalizedPath === "/api/patterns/source-card" && request.method === "GET") {
34005: 
34006:       const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
34007:       const patternId = Math.trunc(Number(url.searchParams.get("saved_pattern_id") ?? 0));
34008:       if (!appUserId || !Number.isInteger(patternId) || patternId <= 0) {
34009:         return new Response(JSON.stringify({ error: "app_user_id and saved_pattern_id are required" }), {
34010:           status: 400,
34011:           headers: { "Content-Type": "application/json" },
34012:         });
34013:       }
34014:       const accountId = await resolvePatternAccountId(
34015:         env,
34016:         url.searchParams.get("threads_user_id"),
34017:         url.searchParams.get("account_id"),
34018:       );
34019:       const ownedPattern = await env.DB.prepare(
34020:         `SELECT id FROM external_patterns
34021:          WHERE id = ? AND app_user_id = ? AND account_id = ? LIMIT 1`,
34022:       ).bind(patternId, appUserId, accountId).first<{ id: number | string }>();
34023:       if (!ownedPattern) {
34024:         return new Response(JSON.stringify({ error: "saved_pattern_not_found" }), {
34025:           status: 404,
34026:           headers: { "Content-Type": "application/json" },
34027:         });
34028:       }
34029:       await ensureOwnerEditLearningTables(env);
34030:       const sourceCard = await resolveSavedPatternSourceCard(env.DB, { accountId, patternId });
34031:       return new Response(JSON.stringify({
34032:         success: true,
34033:         saved_pattern_id: patternId,
34034:         source_card: sourceCard,
34035:       }), {
34036:         status: 200,
34037:         headers: { "Content-Type": "application/json" },
34038:       });
34039:     }
34040: 
34041:     if (normalizedPath === "/api/patterns/source-card/guidance" && request.method === "POST") {
34042:       let payload: {
34043:         app_user_id?: unknown;
34044:         account_id?: unknown;
34045:         threads_user_id?: unknown;
34046:         saved_pattern_id?: unknown;
34047:         guidance_text?: unknown;
34048:         active?: unknown;
34049:       };
34050:       try {
34051:         payload = await request.json();
34052:       } catch {
34053:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
34054:           status: 400,
34055:           headers: { "Content-Type": "application/json" },
34056:         });
34057:       }
34058:       const appUserId = normalizeAppUserId(typeof payload.app_user_id === "string" ? payload.app_user_id : null);
34059:       const patternId = Math.trunc(Number(payload.saved_pattern_id ?? 0));
34060:       const threadsUserId = normalizeOperatorText(payload.threads_user_id, 255, true);
34061:       if (!appUserId || !threadsUserId || !Number.isInteger(patternId) || patternId <= 0) {
34062:         return new Response(JSON.stringify({ error: "app_user_id, threads_user_id, and saved_pattern_id are required" }), {
34063:           status: 400,
34064:           headers: { "Content-Type": "application/json" },
34065:         });
34066:       }
34067:       const accountId = await resolvePatternAccountId(
34068:         env,
34069:         threadsUserId,
34070:         typeof payload.account_id === "string" ? payload.account_id : null,
34071:       );
34072:       const ownedPattern = await env.DB.prepare(
34073:         `SELECT id FROM external_patterns
34074:          WHERE id = ? AND app_user_id = ? AND account_id = ? LIMIT 1`,
34075:       ).bind(patternId, appUserId, accountId).first<{ id: number | string }>();
34076:       if (!ownedPattern) {
34077:         return new Response(JSON.stringify({ error: "saved_pattern_not_found" }), {
34078:           status: 404,
34079:           headers: { "Content-Type": "application/json" },
34080:         });
34081:       }
34082:       await ensureOwnerEditLearningTables(env);
34083:       const sourceCard = await resolveSavedPatternSourceCard(env.DB, { accountId, patternId });
34084:       if (!sourceCard?.id || !sourceCard.brand_key) {
34085:         return new Response(JSON.stringify({ error: "linked_source_card_not_found" }), {
34086:           status: 404,
```

## /api/patterns/update

Web refs: lensically-web/app/(internal)/saved-patterns/page.tsx:92

### Worker occurrence line 34158

```ts
34113:     if (normalizedPath === "/api/patterns/delete" && request.method === "POST") {
34114:       let payload: {
34115:         app_user_id?: unknown;
34116:         account_id?: unknown;
34117:         threads_user_id?: unknown;
34118:         ids?: unknown;
34119:       };
34120:       try {
34121:         payload = await request.json();
34122:       } catch {
34123:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
34124:           status: 400,
34125:           headers: { "Content-Type": "application/json" },
34126:         });
34127:       }
34128: 
34129:       const appUserId = normalizeAppUserId(
34130:         typeof payload.app_user_id === "string" ? payload.app_user_id : null,
34131:       );
34132:       if (!appUserId) {
34133:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
34134:           status: 400,
34135:           headers: { "Content-Type": "application/json" },
34136:         });
34137:       }
34138: 
34139:       const ids = Array.isArray(payload.ids) ? payload.ids.map((value) => Number(value)) : [];
34140:       const accountId = await resolvePatternAccountId(
34141:         env,
34142:         typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
34143:         typeof payload.account_id === "string" ? payload.account_id : null,
34144:       );
34145:       const deleted = await deleteExternalPatterns(env, appUserId, accountId, ids);
34146: 
34147:       return new Response(JSON.stringify({
34148:         success: true,
34149:         app_user_id: appUserId,
34150:         account_id: accountId,
34151:         deleted,
34152:       }), {
34153:         status: 200,
34154:         headers: { "Content-Type": "application/json" },
34155:       });
34156:     }
34157: 
34158:     if (normalizedPath === "/api/patterns/update" && request.method === "POST") {
34159:       let payload: {
34160:         app_user_id?: unknown;
34161:         account_id?: unknown;
34162:         threads_user_id?: unknown;
34163:         id?: unknown;
34164:         post_text?: unknown;
34165:       };
34166:       try {
34167:         payload = await request.json();
34168:       } catch {
34169:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
34170:           status: 400,
34171:           headers: { "Content-Type": "application/json" },
34172:         });
34173:       }
34174: 
34175:       const appUserId = normalizeAppUserId(
34176:         typeof payload.app_user_id === "string" ? payload.app_user_id : null,
34177:       );
34178:       if (!appUserId) {
34179:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
34180:           status: 400,
34181:           headers: { "Content-Type": "application/json" },
34182:         });
34183:       }
34184: 
34185:       try {
34186:         const accountId = await resolvePatternAccountId(
34187:           env,
34188:           typeof payload.threads_user_id === "string" ? payload.threads_user_id : null,
34189:           typeof payload.account_id === "string" ? payload.account_id : null,
34190:         );
34191:         const pattern = await updateExternalPatternText(
34192:           env,
34193:           appUserId,
34194:           accountId,
34195:           Number(payload.id),
34196:           typeof payload.post_text === "string" ? payload.post_text : "",
34197:         );
34198: 
34199:         if (!pattern) {
34200:           return new Response(JSON.stringify({ error: "pattern_not_found" }), {
34201:             status: 404,
34202:             headers: { "Content-Type": "application/json" },
34203:           });
```

## /api/signal-radar/overview

Web refs: lensically-web/app/(internal)/signal-radar/page.tsx:82

### Worker occurrence line 34922

```ts
34877:           source: "threads_me_upstream_refresh",
34878:           app_user_id: ownedAppUserId,
34879:           threads_user_id: account.threads_user_id,
34880:         });
34881:       } catch (error) {
34882:         logWorkerEvent("THREADS_PROFILE_CACHE_UPSERT_FAILED", {
34883:           app_user_id: ownedAppUserId,
34884:           threads_user_id: account.threads_user_id,
34885:           error: getErrorMessage(error),
34886:         }, "error");
34887:       }
34888: 
34889:       return new Response(
34890:         JSON.stringify({
34891:           connected: true,
34892:           account: accountPayload,
34893:           accounts: linkedAccountsPayload,
34894:           active_threads_user_id: activeThreadsUserId,
34895:           ...accountPayload,
34896:         }),
34897:         {
34898:           status: meResp.status,
34899:           headers: {
34900:             "Content-Type": "application/json",
34901:             ...requestCorsHeaders,
34902:           },
34903:         },
34904:       );
34905:     }
34906: 
34907:             if (url.pathname === "/api/threads/intelligence-dashboard") {
34908:       return new Response(JSON.stringify({
34909:         success: false,
34910:         error: "intelligence_dashboard_retired",
34911:         intelligence_backend_active: true,
34912:       }), {
34913:         status: 410,
34914:         headers: {
34915:           "Content-Type": "application/json",
34916:           "Cache-Control": "no-store",
34917:           ...requestCorsHeaders,
34918:         },
34919:       });
34920:     }
34921: 
34922:                 if (url.pathname === "/api/signal-radar/overview" && request.method === "GET") {
34923:           const requestedLimit = Number(url.searchParams.get("limit") ?? "60");
34924:           const overview = await readSignalRadarOverview(env.DB, requestedLimit);
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
```

## /api/source-cards/create

Web refs: lensically-web/app/(internal)/source-cards/page.tsx:77, lensically-web/scripts/test-source-cards-ui.mjs:18

### Worker occurrence line 33746

```ts
33701:           created_by: row.created_by ?? null,
33702:           version_number: Number(row.version_number ?? 1),
33703:           is_current: Number(row.is_current ?? 0) === 1,
33704:           supersedes_source_card_id: row.supersedes_source_card_id ?? null,
33705:           version_reason: row.version_reason ?? null,
33706:           transformation_contract: safeParseJsonString(String(row.transformation_contract_json ?? "{}")),
33707:           locked_at: row.locked_at ?? null,
33708:           created_at: row.created_at ?? null,
33709:           updated_at: row.updated_at ?? null,
33710:           source_origin: {
33711:             type: String(row.source_origin_type ?? "source_card"),
33712:             internal_source_id: row.source_origin_internal_id ?? null,
33713:             source_identity_key: row.source_identity_key ?? null,
33714:             canonical_source_url: row.canonical_source_url ?? primarySourceRecord.canonical_source_url ?? null,
33715:           },
33716:           lifecycle: {
33717:             label: row.lifetime_label ?? "untested",
33718:             confidence: row.confidence_label ?? "low",
33719:             sample_size: Number(row.lifetime_sample_size ?? 0),
33720:             lifetime_index: Number(row.lifetime_index ?? 1),
33721:             probability_above_median: Number(row.probability_above_median ?? 0.5),
33722:           },
33723:           owner_guidance: row.owner_guidance_text
33724:             ? { text: String(row.owner_guidance_text), active: true }
33725:             : null,
33726:           generation_run_count: Number(row.generation_run_count ?? 0),
33727:         };
33728:       });
33729:       return new Response(JSON.stringify({
33730:         success: true,
33731:         app_user_id: appUserId,
33732:         account_id: accountId,
33733:         brand_key: brandKey,
33734:         cards,
33735:         total,
33736:         page,
33737:         page_size: limit,
33738:         total_pages: Math.max(1, Math.ceil(total / limit)),
33739:         current_only: currentOnly,
33740:       }), {
33741:         status: 200,
33742:         headers: { "Content-Type": "application/json" },
33743:       });
33744:     }
33745: 
33746:     if (normalizedPath === "/api/source-cards/create" && request.method === "POST") {
33747:       let payload: Record<string, unknown>;
33748:       try {
33749:         payload = await request.json();
33750:       } catch {
33751:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
33752:           status: 400,
33753:           headers: { "Content-Type": "application/json" },
33754:         });
33755:       }
33756:       const appUserId = normalizeAppUserId(typeof payload.app_user_id === "string" ? payload.app_user_id : null);
33757:       const threadsUserId = normalizeOperatorText(payload.threads_user_id, 255, true);
33758:       if (!appUserId || !threadsUserId) {
33759:         return new Response(JSON.stringify({ error: "app_user_id and threads_user_id are required" }), {
33760:           status: 400,
33761:           headers: { "Content-Type": "application/json" },
33762:         });
33763:       }
33764:       const accountId = await resolvePatternAccountId(
33765:         env,
33766:         threadsUserId,
33767:         typeof payload.account_id === "string" ? payload.account_id : null,
33768:       );
33769:       const brandKey = getBrandKeyForAccountId(accountId);
33770:       if (!brandKey) {
33771:         return new Response(JSON.stringify({ error: "source_card_account_not_configured" }), {
33772:           status: 404,
33773:           headers: { "Content-Type": "application/json" },
33774:         });
33775:       }
33776:       const title = normalizeOperatorText(payload.title, 500);
33777:       const sourceText = normalizeOperatorText(payload.source_text, 20000);
33778:       const sourceMechanism = normalizeOperatorText(payload.source_mechanism, 4000);
33779:       const requiredProduct = normalizeOperatorText(payload.required_product, 4000);
33780:       const audienceReward = normalizeOperatorText(payload.audience_reward, 4000);
33781:       if (!title || !sourceText || !sourceMechanism || !requiredProduct || !audienceReward) {
33782:         return new Response(JSON.stringify({
33783:           error: "title_source_text_source_mechanism_required_product_and_audience_reward_are_required",
33784:         }), {
33785:           status: 400,
33786:           headers: { "Content-Type": "application/json" },
33787:         });
33788:       }
33789:       const normalizeStringArray = (value: unknown): string[] => Array.isArray(value)
33790:         ? value.map((item) => normalizeOperatorText(item, 2000, true)).filter((item): item is string => Boolean(item))
33791:         : [];
```

## /api/source-cards/guidance

Web refs: lensically-web/app/(internal)/source-cards/page.tsx:78, lensically-web/scripts/test-source-cards-ui.mjs:19

### Worker occurrence line 33941

```ts
33896:           normalizeOperatorJson(primarySource, {}),
33897:           normalizeOperatorJson(metricsSnapshot, {}),
33898:           sourceMechanism,
33899:           requiredProduct,
33900:           normalizeOperatorJson(forbiddenSurfaces, []),
33901:           normalizeOperatorJson(dangerSurfaces, []),
33902:           normalizeOperatorJson(passConditions, []),
33903:           normalizeOperatorJson(failConditions, []),
33904:           normalizeOperatorText(payload.recommended_direction, 4000, true),
33905:           familyId,
33906:           selectionId,
33907:           normalizeOperatorJson(transformationContract, {}),
33908:           nowIso,
33909:         ),
33910:         env.DB.prepare(
33911:           `UPDATE operator_source_selections
33912:            SET source_card_id = ?, workflow_sequence = 1
33913:            WHERE id = ? AND brand_key = ?`,
33914:         ).bind(sourceCardId, selectionId, brandKey),
33915:       ]);
33916:       await ensureOwnerEditLearningTables(env);
33917:       const ownerGuidance = normalizeOperatorText(payload.owner_guidance, 20000, true);
33918:       if (ownerGuidance) {
33919:         await saveSourceCardOwnerGuidance(env.DB, {
33920:           brandKey,
33921:           accountId,
33922:           threadsUserId,
33923:           sourceCardId,
33924:           guidanceText: ownerGuidance,
33925:           active: true,
33926:         });
33927:       }
33928:       const sourceCard = await getOperatorSourceCard(env, brandKey, sourceCardId);
33929:       return new Response(JSON.stringify({
33930:         success: true,
33931:         account_id: accountId,
33932:         brand_key: brandKey,
33933:         source_card: sourceCard,
33934:         validation,
33935:       }), {
33936:         status: 201,
33937:         headers: { "Content-Type": "application/json" },
33938:       });
33939:     }
33940: 
33941:     if (normalizedPath === "/api/source-cards/guidance" && request.method === "POST") {
33942:       let payload: Record<string, unknown>;
33943:       try {
33944:         payload = await request.json();
33945:       } catch {
33946:         return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
33947:           status: 400,
33948:           headers: { "Content-Type": "application/json" },
33949:         });
33950:       }
33951:       const appUserId = normalizeAppUserId(typeof payload.app_user_id === "string" ? payload.app_user_id : null);
33952:       const threadsUserId = normalizeOperatorText(payload.threads_user_id, 255, true);
33953:       const sourceCardId = normalizeOperatorText(payload.source_card_id, 120);
33954:       if (!appUserId || !threadsUserId || !sourceCardId) {
33955:         return new Response(JSON.stringify({ error: "app_user_id, threads_user_id, and source_card_id are required" }), {
33956:           status: 400,
33957:           headers: { "Content-Type": "application/json" },
33958:         });
33959:       }
33960:       const accountId = await resolvePatternAccountId(
33961:         env,
33962:         threadsUserId,
33963:         typeof payload.account_id === "string" ? payload.account_id : null,
33964:       );
33965:       const brandKey = getBrandKeyForAccountId(accountId);
33966:       if (!brandKey) {
33967:         return new Response(JSON.stringify({ error: "source_card_account_not_configured" }), {
33968:           status: 404,
33969:           headers: { "Content-Type": "application/json" },
33970:         });
33971:       }
33972:       const ownedCard = await env.DB.prepare(
33973:         `SELECT id FROM operator_source_cards WHERE id = ? AND brand_key = ? LIMIT 1`,
33974:       ).bind(sourceCardId, brandKey).first<{ id: string }>();
33975:       if (!ownedCard) {
33976:         return new Response(JSON.stringify({ error: "source_card_not_found" }), {
33977:           status: 404,
33978:           headers: { "Content-Type": "application/json" },
33979:         });
33980:       }
33981:       await ensureOwnerEditLearningTables(env);
33982:       try {
33983:         const guidance = await saveSourceCardOwnerGuidance(env.DB, {
33984:           brandKey,
33985:           accountId,
33986:           threadsUserId,
```

## /api/source-cards/list

Web refs: lensically-web/app/(internal)/source-cards/page.tsx:76, lensically-web/scripts/test-source-cards-ui.mjs:17

### Worker occurrence line 33612

```ts
33567:         : `SELECT id, app_user_id, account_id, platform, source_url, post_id, author_handle, author_display_name,
33568:                   post_text, likes, replies, reposts, shares, views, posted_at, capture_confidence,
33569:                   raw_payload, saved_at, updated_at
33570:            FROM external_patterns
33571:            WHERE app_user_id = ? AND account_id = ?
33572:            ORDER BY datetime(updated_at) DESC, id DESC
33573:            LIMIT ? OFFSET ?`;
33574:       const rows = await env.DB.prepare(listSql)
33575:         .bind(appUserId, accountId, limit, offset)
33576:         .all<ExternalPatternRow>();
33577: 
33578:       const totalRow = await env.DB.prepare(
33579:         `SELECT COUNT(*) AS total
33580:          FROM external_patterns
33581:          WHERE app_user_id = ? AND account_id = ?`,
33582:       )
33583:         .bind(appUserId, accountId)
33584:         .first<{ total: number | string }>();
33585: 
33586:       const total = Number(totalRow?.total ?? 0);
33587:       const totalPages = Math.max(1, Math.ceil(total / limit));
33588: 
33589:             const sanitizedRows = (rows.results ?? []).map(sanitizeExternalPatternRow);
33590:       const requestedThreadsUserId = normalizeOperatorText(url.searchParams.get("threads_user_id"), 255, true);
33591:       const ownerLearningSummary = requestedThreadsUserId
33592:         ? await readOwnerLearningSummary(env.DB, requestedThreadsUserId)
33593:         : null;
33594: 
33595:       return new Response(JSON.stringify({
33596:         success: true,
33597:         app_user_id: appUserId,
33598:         account_id: accountId,
33599:         order,
33600:         total,
33601:         page,
33602:         page_size: limit,
33603:         total_pages: totalPages,
33604:         patterns: sanitizedRows,
33605:         owner_learning_summary: ownerLearningSummary,
33606:       }), {
33607:         status: 200,
33608:         headers: { "Content-Type": "application/json" },
33609:       });
33610:     }
33611: 
33612:             if (normalizedPath === "/api/source-cards/list" && request.method === "GET") {
33613:       const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
33614:       if (!appUserId) {
33615:         return new Response(JSON.stringify({ error: "app_user_id is required" }), {
33616:           status: 400,
33617:           headers: { "Content-Type": "application/json" },
33618:         });
33619:       }
33620:       const accountId = await resolvePatternAccountId(
33621:         env,
33622:         url.searchParams.get("threads_user_id"),
33623:         url.searchParams.get("account_id"),
33624:       );
33625:       const brandKey = getBrandKeyForAccountId(accountId);
33626:       if (!brandKey) {
33627:         return new Response(JSON.stringify({ error: "source_card_account_not_configured" }), {
33628:           status: 404,
33629:           headers: { "Content-Type": "application/json" },
33630:         });
33631:       }
33632:       const rawLimit = Number(url.searchParams.get("limit") ?? "20");
33633:       const limit = Number.isFinite(rawLimit) && rawLimit > 0
33634:         ? Math.min(50, Math.floor(rawLimit))
33635:         : 20;
33636:       const rawPage = Number(url.searchParams.get("page") ?? "1");
33637:       const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
33638:       const offset = (page - 1) * limit;
33639:       const currentOnly = url.searchParams.get("current_only") === "true";
33640:       const currentClause = currentOnly ? "AND card.is_current = 1" : "";
33641:       await ensureOwnerEditLearningTables(env);
33642:       const rows = await env.DB.prepare(
33643:         `SELECT card.id, card.family_id, card.sequence_label, card.lane_key, card.title,
33644:                 card.status, card.primary_source_json, card.metrics_snapshot_json,
33645:                 card.source_mechanism, card.required_product, card.forbidden_surfaces_json,
33646:                 card.danger_surfaces_json, card.pass_conditions_json, card.fail_conditions_json,
33647:                 card.recommended_direction, card.created_by, card.version_number, card.is_current,
33648:                 card.supersedes_source_card_id, card.version_reason, card.transformation_contract_json,
33649:                 card.locked_at, card.created_at, card.updated_at,
33650:                 family.source_identity_key,
33651:                 COALESCE(selection.source_type, family.source_type, 'source_card') AS source_origin_type,
33652:                 COALESCE(selection.internal_source_id, family.internal_source_id, card.id) AS source_origin_internal_id,
33653:                 selection.canonical_source_url,
33654:                 state.lifetime_label, state.confidence_label, state.lifetime_sample_size,
33655:                 state.lifetime_index, state.probability_above_median,
33656:                 (SELECT guidance_text
33657:                  FROM operator_source_card_owner_guidance guidance
```

## /api/threads/accounts

Web refs: lensically-web/app/(internal)/schedule/page.tsx:43, lensically-web/app/(internal)/scheduled-posts/page.tsx:63, lensically-web/app/mobile-save/page.tsx:10, lensically-web/components/ThreadsAccountSwitcher.tsx:28

### Worker occurrence line 35083

```ts
35038:       );
35039:       const currentPageRows = snapshotRows.slice(0, limit);
35040: 
35041:       const rows = currentPageRows.map((row, index) => {
35042:         const olderSnapshot = snapshotRows[index + 1] ?? null;
35043:         const startOfDayFollowers = row.baseline_followers_count ?? row.followers_count;
35044:         const gapCarry = olderSnapshot
35045:           ? startOfDayFollowers - olderSnapshot.followers_count
35046:           : 0;
35047:         const netChange = olderSnapshot
35048:           ? row.followers_count - olderSnapshot.followers_count
35049:           : row.followers_count - startOfDayFollowers;
35050: 
35051:         return {
35052:           date: row.snapshot_date,
35053:           start_of_day_followers: startOfDayFollowers,
35054:           gap_carry: gapCarry,
35055:           latest_followers: row.followers_count,
35056:           net_change: netChange,
35057:           updated_at: row.captured_at,
35058:         };
35059:       });
35060: 
35061:       const totalPages = Math.max(1, Math.ceil(totalCount / limit));
35062: 
35063:       return new Response(
35064:         JSON.stringify({
35065:           rows,
35066:           total_count: totalCount,
35067:           page,
35068:           page_size: limit,
35069:           total_pages: totalPages,
35070:           timezone: THREADS_INSIGHTS_TIME_ZONE,
35071:         }),
35072:         {
35073:           status: 200,
35074:           headers: {
35075:             "Content-Type": "application/json",
35076:             "Cache-Control": "no-store",
35077:             ...requestCorsHeaders,
35078:           },
35079:         },
35080:       );
35081:     }
35082: 
35083:     if (url.pathname === "/api/threads/accounts" && request.method === "GET") {
35084:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
35085:       const configuredAccounts = await getConfiguredThreadsProfiles(env);
35086:       if (configuredAccounts.length > 0) {
35087:         const activeAccount = configuredAccounts.find((account) => selectedThreadsUserId && account.threads_user_id === selectedThreadsUserId)
35088:           ?? configuredAccounts.find((account) => account.is_active)
35089:           ?? configuredAccounts[0];
35090: 
35091:         return new Response(
35092:           JSON.stringify({
35093:             connected: true,
35094:             accounts: configuredAccounts,
35095:             active_threads_user_id: activeAccount.threads_user_id,
35096:           }),
35097:           {
35098:             status: 200,
35099:             headers: {
35100:               "Content-Type": "application/json",
35101:               ...requestCorsHeaders,
35102:             },
35103:           },
35104:         );
35105:       }
35106: 
35107:       const authUser = await requireAuth(request, env);
35108:       if (authUser instanceof Response) {
35109:         return new Response(authUser.body, {
35110:           status: authUser.status,
35111:           statusText: authUser.statusText,
35112:           headers: {
35113:             "Content-Type": "application/json",
35114:             ...requestCorsHeaders,
35115:           },
35116:         });
35117:       }
35118: 
35119:       const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
35120:       if (!appUserId) {
35121:         return new Response(
35122:           JSON.stringify({ error: "Missing app_user_id" }),
35123:           {
35124:             status: 400,
35125:             headers: {
35126:               "Content-Type": "application/json",
35127:               ...requestCorsHeaders,
35128:             },
```

## /api/threads/dashboard

Web refs: lensically-web/app/(internal)/dashboard/page.tsx:79

### Worker occurrence line 34970

```ts
34925:           return new Response(JSON.stringify(overview), {
34926:             status: 200,
34927:             headers: {
34928:               "Content-Type": "application/json",
34929:               "Cache-Control": "no-store",
34930:               ...requestCorsHeaders,
34931:             },
34932:           });
34933:         }
34934: 
34935:         if (url.pathname.startsWith("/api/cycles/") && request.method === "GET") {
34936:       const actionByPath: Record<string, "state" | "history" | "summary" | "selections" | "selection_detail"> = {
34937:         "/api/cycles/state": "state",
34938:         "/api/cycles/history": "history",
34939:         "/api/cycles/summary": "summary",
34940:         "/api/cycles/selections": "selections",
34941:         "/api/cycles/selection-detail": "selection_detail",
34942:       };
34943:       const action = actionByPath[url.pathname];
34944:       if (!action) {
34945:         return notFoundJsonResponse(requestCorsHeaders);
34946:       }
34947:             const result = await readCycleObservability({
34948:         db: env.DB,
34949:         shadowDb: env.SHADOW_DB,
34950:         brandKey: url.searchParams.get("brand_key")?.trim() || "manifest_mental",
34951:         action,
34952:         rail: url.searchParams.get("rail") === "innovation" ? "innovation" : "main",
34953:         id: url.searchParams.get("id")?.trim() || undefined,
34954:         cursor: url.searchParams.get("cursor"),
34955:         limit: Number(url.searchParams.get("limit") ?? "10"),
34956:         showAll: url.searchParams.get("show_all") === "1" || url.searchParams.get("show_all") === "true",
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
34983:             },
34984:           },
34985:         );
34986:       }
34987: 
34988:       const dashboard = await buildThreadsDashboardPayload(env, account);
34989:       return new Response(
34990:         JSON.stringify(dashboard),
34991:         {
34992:           status: 200,
34993:           headers: {
34994:             "Content-Type": "application/json",
34995:             "Cache-Control": "no-store",
34996:             ...requestCorsHeaders,
34997:           },
34998:         },
34999:       );
35000:     }
35001: 
35002:     if (url.pathname === "/api/threads/followers" && request.method === "GET") {
35003:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
35004:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
35005:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
35006: 
35007:       if (!account?.threads_user_id) {
35008:         return new Response(
35009:           JSON.stringify({ error: "Threads account not connected" }),
35010:           {
35011:             status: 404,
35012:             headers: {
35013:               "Content-Type": "application/json",
35014:               ...requestCorsHeaders,
35015:             },
```

## /api/threads/followers

Web refs: lensically-web/app/(internal)/followers/page.tsx:30

### Worker occurrence line 35002

```ts
34957:         slotKey: url.searchParams.get("slot_key")?.trim() || undefined,
34958:         filter: url.searchParams.get("filter"),
34959:       });
34960:       return new Response(JSON.stringify(result.body), {
34961:         status: result.status,
34962:         headers: {
34963:           "Content-Type": "application/json",
34964:           "Cache-Control": "no-store",
34965:           ...requestCorsHeaders,
34966:         },
34967:       });
34968:     }
34969: 
34970:     if (url.pathname === "/api/threads/dashboard" && request.method === "GET") {
34971:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
34972:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34973:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
34974: 
34975:       if (!account?.access_token || !account.threads_user_id) {
34976:         return new Response(
34977:           JSON.stringify({ error: "Threads account not connected" }),
34978:           {
34979:             status: 404,
34980:             headers: {
34981:               "Content-Type": "application/json",
34982:               ...requestCorsHeaders,
34983:             },
34984:           },
34985:         );
34986:       }
34987: 
34988:       const dashboard = await buildThreadsDashboardPayload(env, account);
34989:       return new Response(
34990:         JSON.stringify(dashboard),
34991:         {
34992:           status: 200,
34993:           headers: {
34994:             "Content-Type": "application/json",
34995:             "Cache-Control": "no-store",
34996:             ...requestCorsHeaders,
34997:           },
34998:         },
34999:       );
35000:     }
35001: 
35002:     if (url.pathname === "/api/threads/followers" && request.method === "GET") {
35003:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
35004:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
35005:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
35006: 
35007:       if (!account?.threads_user_id) {
35008:         return new Response(
35009:           JSON.stringify({ error: "Threads account not connected" }),
35010:           {
35011:             status: 404,
35012:             headers: {
35013:               "Content-Type": "application/json",
35014:               ...requestCorsHeaders,
35015:             },
35016:           },
35017:         );
35018:       }
35019: 
35020:       const rawLimit = Number(url.searchParams.get("limit") ?? "100");
35021:       const limit = Number.isFinite(rawLimit)
35022:         ? Math.min(Math.max(Math.trunc(rawLimit), 1), 100)
35023:         : 100;
35024:       const rawPage = Number(url.searchParams.get("page") ?? "1");
35025:       const page = Number.isFinite(rawPage)
35026:         ? Math.max(Math.trunc(rawPage), 1)
35027:         : 1;
35028:       const offset = (page - 1) * limit;
35029: 
35030:       await refreshCurrentThreadsFollowerSnapshot(env, account, THREADS_INSIGHTS_TIME_ZONE);
35031: 
35032:       const totalCount = await countThreadsFollowerSnapshots(env, account.threads_user_id);
35033:       const snapshotRows = await listThreadsFollowerSnapshotsPage(
35034:         env,
35035:         account.threads_user_id,
35036:         limit + 1,
35037:         offset,
35038:       );
35039:       const currentPageRows = snapshotRows.slice(0, limit);
35040: 
35041:       const rows = currentPageRows.map((row, index) => {
35042:         const olderSnapshot = snapshotRows[index + 1] ?? null;
35043:         const startOfDayFollowers = row.baseline_followers_count ?? row.followers_count;
35044:         const gapCarry = olderSnapshot
35045:           ? startOfDayFollowers - olderSnapshot.followers_count
35046:           : 0;
35047:         const netChange = olderSnapshot
```

## /api/threads/me

Web refs: lensically-web/app/(internal)/schedule/page.tsx:44, lensically-web/app/(internal)/scheduled-posts/page.tsx:64, lensically-web/components/sidebar.tsx:42, lensically-web/lib/routeDataPrefetch.ts:37

### Worker occurrence line 34609

```ts
34564:       await ensureMetaDeletionRequestsTable(env);
34565:       const confirmationCode = url.searchParams.get("confirmation_code")?.trim();
34566:       if (!confirmationCode) {
34567:         return new Response(
34568:           JSON.stringify({ error: "Missing confirmation_code" }),
34569:           {
34570:             status: 400,
34571:             headers: { "content-type": "application/json; charset=UTF-8" },
34572:           },
34573:         );
34574:       }
34575: 
34576:       const requestRecord = await env.DB.prepare(
34577:         `SELECT confirmation_code, platform_user_id, status, requested_at, completed_at
34578:          FROM meta_deletion_requests
34579:          WHERE confirmation_code = ?
34580:          LIMIT 1`,
34581:       )
34582:         .bind(confirmationCode)
34583:         .first<MetaDeletionRequestRecord>();
34584: 
34585:       if (!requestRecord) {
34586:         return new Response(
34587:           JSON.stringify({ error: "Deletion request not found" }),
34588:           {
34589:             status: 404,
34590:             headers: { "content-type": "application/json; charset=UTF-8" },
34591:           },
34592:         );
34593:       }
34594: 
34595:       return new Response(
34596:         JSON.stringify({
34597:           confirmation_code: requestRecord.confirmation_code,
34598:           status: requestRecord.status,
34599:           requested_at: requestRecord.requested_at,
34600:           completed_at: requestRecord.completed_at,
34601:         }),
34602:         {
34603:           status: 200,
34604:           headers: { "content-type": "application/json; charset=UTF-8" },
34605:         },
34606:       );
34607:     }
34608: 
34609:     if (url.pathname === "/api/threads/me" && request.method === "GET") {
34610:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
34611:       const configuredAccounts = await getConfiguredThreadsProfiles(env);
34612:       if (configuredAccounts.length > 0) {
34613:         const activeAccount = configuredAccounts.find((account) => selectedThreadsUserId && account.threads_user_id === selectedThreadsUserId)
34614:           ?? configuredAccounts.find((account) => account.is_active)
34615:           ?? configuredAccounts[0];
34616: 
34617:         return new Response(
34618:           JSON.stringify({
34619:             connected: true,
34620:             account: activeAccount,
34621:             accounts: configuredAccounts,
34622:             active_threads_user_id: activeAccount.threads_user_id,
34623:             ...activeAccount,
34624:           }),
34625:           {
34626:             status: 200,
34627:             headers: {
34628:               "Content-Type": "application/json",
34629:               ...requestCorsHeaders,
34630:             },
34631:           },
34632:         );
34633:       }
34634: 
34635:       const authUser = await requireAuth(request, env);
34636:       if (authUser instanceof Response) {
34637:         return new Response(authUser.body, {
34638:           status: authUser.status,
34639:           statusText: authUser.statusText,
34640:           headers: {
34641:             "Content-Type": "application/json",
34642:             ...requestCorsHeaders,
34643:           },
34644:         });
34645:       }
34646: 
34647:       const appUserId = normalizeAppUserId(url.searchParams.get("app_user_id"));
34648:       logWorkerEvent("THREADS_ME_REQUEST_RECEIVED", {
34649:         appUserId,
34650:       });
34651:       if (!appUserId) {
34652:         return new Response(
34653:           JSON.stringify({ error: "Missing app_user_id" }),
34654:           {
```

## /api/threads/post-now

Web refs: lensically-web/app/(internal)/schedule/page.tsx:48

### Worker occurrence line 35537

```ts
35492:       }
35493: 
35494:       const cachedInsights = await getFreshThreadsUserInsightsCache(env, account.threads_user_id);
35495:       if (cachedInsights) {
35496:         const cachedPayload = safeParseJsonString(cachedInsights.insights_json);
35497:         if (cachedPayload !== null) {
35498:           logWorkerEvent("THREADS_USER_INSIGHTS_CACHE_HIT", {
35499:             app_user_id: ownedAppUserId,
35500:             threads_user_id: account.threads_user_id,
35501:             last_refreshed_at: cachedInsights.last_refreshed_at,
35502:           });
35503: 
35504:           return new Response(JSON.stringify(cachedPayload), {
35505:             status: 200,
35506:             headers: { "content-type": "application/json; charset=UTF-8" },
35507:           });
35508:         }
35509:       }
35510: 
35511:       const data = await fetchThreadsUserInsightsByAccount(account.access_token, account.threads_user_id);
35512:       if (data === null) {
35513:         return upstreamProviderErrorResponse(requestCorsHeaders);
35514:       }
35515: 
35516:       try {
35517:         await upsertThreadsUserInsightsCache(env, {
35518:           threads_user_id: account.threads_user_id,
35519:           insights_json: JSON.stringify(data),
35520:         });
35521:       } catch (error) {
35522:         logWorkerEvent("THREADS_USER_INSIGHTS_CACHE_UPSERT_FAILED", {
35523:           app_user_id: ownedAppUserId,
35524:           threads_user_id: account.threads_user_id,
35525:           error: getErrorMessage(error),
35526:         }, "error");
35527:       }
35528: 
35529:       return new Response(JSON.stringify(data), {
35530:         status: 200,
35531:         headers: { "content-type": "application/json; charset=UTF-8" },
35532:       });
35533:     }
35534: 
35535: 
35536:     if (
35537:       (url.pathname === "/api/threads/publish" || url.pathname === "/api/threads/post-now")
35538:       && request.method === "POST"
35539:     ) {
35540:       let payload: {
35541:         app_user_id?: string;
35542:         threads_user_id?: string;
35543:         text?: string;
35544:         spoiler_all_text?: boolean;
35545:         spoiler_phrases?: string[];
35546:       };
35547:       try {
35548:         payload = await request.json();
35549:       } catch {
35550:         return new Response(
35551:           JSON.stringify({ error: "Invalid JSON body" }),
35552:           {
35553:             status: 400,
35554:             headers: { "content-type": "application/json; charset=UTF-8" },
35555:           },
35556:         );
35557:       }
35558: 
35559:       const threadsUserId = payload.threads_user_id?.trim();
35560:       const text = payload.text?.trim();
35561:       const spoilerAllText = normalizeSpoilerFlag(payload.spoiler_all_text);
35562:       const spoilerPhrases = normalizeSpoilerPhrasesInput(payload.spoiler_phrases);
35563: 
35564:       if (!threadsUserId || !text) {
35565:         return new Response(
35566:           JSON.stringify({ error: "threads_user_id and text are required" }),
35567:           {
35568:             status: 400,
35569:             headers: { "content-type": "application/json; charset=UTF-8" },
35570:           },
35571:         );
35572:       }
35573:       const spoilerValidationError = validateTextSpoilerConfig(text, spoilerAllText, spoilerPhrases);
35574:       if (spoilerValidationError) {
35575:         return new Response(
35576:           JSON.stringify({ error: spoilerValidationError }),
35577:           {
35578:             status: 400,
35579:             headers: { "content-type": "application/json; charset=UTF-8" },
35580:           },
35581:         );
35582:       }
```

## /api/threads/posts

Web refs: lensically-web/app/(internal)/insights/PostsList.tsx:33, lensically-web/lib/routeDataPrefetch.ts:38

### Worker occurrence line 35175

```ts
35130:         );
35131:       }
35132:       const ownedAppUserId = resolveAuthenticatedAppUserId(authUser.id, appUserId);
35133:       if (!ownedAppUserId) {
35134:         return forbiddenJsonResponse(requestCorsHeaders);
35135:       }
35136: 
35137:       const linkedAccounts = await listConnectedThreadsAccountsForAppUser(env, ownedAppUserId);
35138:       const linkedAccountsPayload = linkedAccounts.map((linkedAccount) => ({
35139:         threads_user_id: linkedAccount.threads_user_id,
35140:         is_active: linkedAccount.is_active === 1,
35141:         created_at: linkedAccount.created_at,
35142:         username: linkedAccount.username ?? null,
35143:         name: linkedAccount.name ?? null,
35144:         threads_biography: linkedAccount.threads_biography ?? null,
35145:         is_verified: linkedAccount.is_verified === 1,
35146:         threads_profile_picture_url: linkedAccount.threads_profile_picture_url ?? null,
35147:       }));
35148:       const activeThreadsUserId = linkedAccounts.find((linkedAccount) => linkedAccount.is_active === 1)?.threads_user_id
35149:         ?? linkedAccounts[0]?.threads_user_id
35150:         ?? null;
35151: 
35152:       return new Response(
35153:         JSON.stringify({
35154:           connected: linkedAccountsPayload.length > 0,
35155:           accounts: linkedAccountsPayload,
35156:           active_threads_user_id: activeThreadsUserId,
35157:         }),
35158:         {
35159:           status: 200,
35160:           headers: {
35161:             "Content-Type": "application/json",
35162:             ...requestCorsHeaders,
35163:           },
35164:         },
35165:       );
35166:     }
35167: 
35168:     if (url.pathname.startsWith("/api/agent/")) {
35169:       return new Response(JSON.stringify({ success: false, error: "legacy_agent_mode_retired", local_execution_active: false }), {
35170:         status: 410,
35171:         headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...requestCorsHeaders },
35172:       });
35173:     }
35174: 
35175:     if (url.pathname === "/api/threads/posts" && request.method === "GET") {
35176:       const appUserId = WORKSPACE_APP_USER_ID;
35177:       const cursor = url.searchParams.get("cursor");
35178:       const cursorDepthParam = Number(url.searchParams.get("cursor_depth") || 0);
35179:       const cursorDepth = Number.isFinite(cursorDepthParam) && cursorDepthParam > 0
35180:         ? cursorDepthParam
35181:         : (cursor ? 2 : 1);
35182:       logWorkerEvent("THREADS_POSTS_REQUEST", {
35183:         app_user_id: appUserId,
35184:       });
35185: 
35186:       if (cursorDepth > MAX_THREADS_POST_CURSOR_DEPTH) {
35187:         return new Response(
35188:           JSON.stringify({
35189:             posts: [],
35190:             has_more: false,
35191:           }),
35192:           {
35193:             status: 200,
35194:             headers: {
35195:               "Content-Type": "application/json",
35196:               ...requestCorsHeaders,
35197:             },
35198:           },
35199:         );
35200:       }
35201: 
35202:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
35203:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
35204: 
35205:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
35206:       logWorkerEvent("THREADS_ACCOUNT_LOOKUP_RESULT", {
35207:         found: Boolean(account),
35208:         threads_user_id: account?.threads_user_id ?? null,
35209:       });
35210: 
35211:       if (!account || !account.access_token) {
35212:         return new Response(
35213:           JSON.stringify({ error: "Threads access token missing" }),
35214:           {
35215:             status: 500,
35216:             headers: {
35217:               "Content-Type": "application/json",
35218:               ...requestCorsHeaders,
35219:             },
35220:           },
```

## /api/threads/posts/archive

Web refs: lensically-web/app/(internal)/post-archive/page.tsx:40

### Worker occurrence line 35308

```ts
35263: 
35264:       const hasMore = postsPage.hasMore && cursorDepth < MAX_THREADS_POST_CURSOR_DEPTH;
35265:       const nextCursor = cursorDepth < MAX_THREADS_POST_CURSOR_DEPTH ? postsPage.nextCursor : null;
35266: 
35267:       try {
35268:         await upsertThreadsPostsArchive(env, account.threads_user_id, postsPage.posts);
35269:       } catch (error) {
35270:         logWorkerEvent("THREADS_POSTS_ARCHIVE_UPSERT_FAILED", {
35271:           app_user_id: ownedAppUserId,
35272:           threads_user_id: account.threads_user_id,
35273:           has_cursor: Boolean(cursor),
35274:           error: getErrorMessage(error),
35275:         }, "error");
35276:       }
35277: 
35278:       if (!cursor) {
35279:         try {
35280:           await replaceThreadsPostsCache(env, account.threads_user_id, postsPage.posts, {
35281:             threads_user_id: account.threads_user_id,
35282:             next_cursor: nextCursor,
35283:             has_more: hasMore,
35284:           });
35285:         } catch (error) {
35286:           logWorkerEvent("THREADS_POSTS_CACHE_UPSERT_FAILED", {
35287:             app_user_id: ownedAppUserId,
35288:             threads_user_id: account.threads_user_id,
35289:             error: getErrorMessage(error),
35290:           }, "error");
35291:         }
35292:       }
35293: 
35294:       return new Response(JSON.stringify({
35295:         posts: postsPage.posts,
35296:         next_cursor: nextCursor,
35297:         has_more: hasMore,
35298:       }), {
35299:         status: 200,
35300:         headers: {
35301:           "Content-Type": "application/json",
35302:           "Cache-Control": "no-store",
35303:           ...requestCorsHeaders,
35304:         },
35305:       });
35306:     }
35307: 
35308:     if (url.pathname === "/api/threads/posts/archive" && request.method === "GET") {
35309:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
35310:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
35311: 
35312:       const account = await getThreadsAccountForAppUser(env, ownedAppUserId, selectedThreadsUserId);
35313:       if (!account || !account.threads_user_id) {
35314:         return new Response(
35315:           JSON.stringify({ error: "Threads access token missing" }),
35316:           {
35317:             status: 500,
35318:             headers: {
35319:               "Content-Type": "application/json",
35320:               ...requestCorsHeaders,
35321:             },
35322:           },
35323:         );
35324:       }
35325: 
35326:       const requestedOrder = url.searchParams.get("order")?.trim().toLowerCase();
35327:       const order = requestedOrder === "top" ? "top" : "recent";
35328:       const rawLimit = Number(url.searchParams.get("limit") ?? "200");
35329:       const limit = Number.isFinite(rawLimit)
35330:         ? Math.min(Math.max(Math.trunc(rawLimit), 1), 1000)
35331:         : 200;
35332:       const rawPage = Number(url.searchParams.get("page") ?? "1");
35333:       const page = Number.isFinite(rawPage)
35334:         ? Math.max(Math.trunc(rawPage), 1)
35335:         : 1;
35336:       const offset = (page - 1) * limit;
35337: 
35338:       const archive = await listArchivedThreadsPosts(env, account.threads_user_id, order, limit, offset);
35339:       const totalPages = Math.max(1, Math.ceil(archive.totalCount / limit));
35340: 
35341:       return new Response(JSON.stringify({
35342:         posts: archive.posts,
35343:         total_count: archive.totalCount,
35344:         order,
35345:         page,
35346:         page_size: limit,
35347:         total_pages: totalPages,
35348:       }), {
35349:         status: 200,
35350:         headers: {
35351:           "Content-Type": "application/json",
35352:           "Cache-Control": "no-store",
35353:           ...requestCorsHeaders,
```

## /api/threads/schedule

Web refs: lensically-web/app/(internal)/schedule/page.tsx:49, lensically-web/app/(internal)/scheduled-posts/page.tsx:66, lensically-web/components/BatchSchedulePanel.tsx:51

### Worker occurrence line 35970

```ts
35925:           count,
35926:           account: {
35927:             username: cachedProfile?.username ?? null,
35928:             name: cachedProfile?.name ?? null,
35929:             threads_biography: cachedProfile?.threads_biography ?? null,
35930:           },
35931:           topic,
35932:           archiveRecent: archiveRecent.posts,
35933:           archiveTop: archiveTop.posts,
35934:           scheduledPosts,
35935:           savedPatterns: savedPatterns.patterns,
35936:         });
35937: 
35938:         return new Response(
35939:           JSON.stringify({
35940:             success: true,
35941:             model: generated.model,
35942:             posts: generated.posts,
35943:             context_summary: {
35944:               archive_recent: archiveRecent.posts.length,
35945:               archive_top: archiveTop.posts.length,
35946:               scheduled_posts: scheduledPosts.length,
35947:               saved_patterns: savedPatterns.patterns.length,
35948:             },
35949:           }),
35950:           {
35951:             status: 200,
35952:             headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
35953:           },
35954:         );
35955:       } catch (error) {
35956:         logWorkerEvent("HERMES_GENERATION_FAILURE", {
35957:           threads_user_id: threadsUserId,
35958:           message: getErrorMessage(error),
35959:         });
35960:         return new Response(
35961:           JSON.stringify({ error: getErrorMessage(error) || "Could not generate posts." }),
35962:           {
35963:             status: 502,
35964:             headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
35965:           },
35966:         );
35967:       }
35968:     }
35969: 
35970:     if (url.pathname === "/api/threads/schedule" && request.method === "POST") {
35971:       let payload: {
35972:         app_user_id?: string;
35973:         threads_user_id?: string;
35974:         text?: string;
35975:         date?: string;
35976:         time?: string;
35977:         timezone?: string;
35978:         spoiler_all_text?: boolean;
35979:         spoiler_phrases?: string[];
35980:       };
35981:       try {
35982:         payload = await request.json();
35983:       } catch {
35984:         return new Response(
35985:           JSON.stringify({ error: "Invalid JSON body" }),
35986:           {
35987:             status: 400,
35988:             headers: { "content-type": "application/json; charset=UTF-8" },
35989:           },
35990:         );
35991:       }
35992: 
35993:       const threadsUserId = payload.threads_user_id?.trim();
35994:       const text = payload.text?.trim();
35995:       const date = payload.date?.trim();
35996:       const time = payload.time?.trim();
35997:       const timezone = payload.timezone?.trim() || null;
35998:       const spoilerAllText = normalizeSpoilerFlag(payload.spoiler_all_text);
35999:       const spoilerPhrases = normalizeSpoilerPhrasesInput(payload.spoiler_phrases);
36000: 
36001:       if (!threadsUserId || !text || !date || !time) {
36002:         return new Response(
36003:           JSON.stringify({
36004:             error: "threads_user_id, text, date, and time are required",
36005:           }),
36006:           {
36007:             status: 400,
36008:             headers: { "content-type": "application/json; charset=UTF-8" },
36009:           },
36010:         );
36011:       }
36012: 
36013:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
36014:       const resolvedTimezone = timezone ?? WORKSPACE_DEFAULT_TIMEZONE;
36015: 
```

### Worker occurrence line 36586

```ts
36541:       });
36542: 
36543:       const refreshed = await env.DB.prepare(
36544:         `SELECT status, published_post_id, publish_error_message
36545:          FROM scheduled_posts
36546:          WHERE id = ?
36547:            AND user_id = ?
36548:          LIMIT 1`,
36549:       )
36550:         .bind(scheduledPostId, ownedAppUserId)
36551:         .first<{
36552:           status: string;
36553:           published_post_id: string | null;
36554:           publish_error_message: string | null;
36555:         }>();
36556: 
36557:       const publishedPostId = refreshed?.published_post_id?.trim() || null;
36558:       if (refreshed?.status === SCHEDULED_POST_STATUS_POSTED && publishedPostId) {
36559:         return new Response(
36560:           JSON.stringify({
36561:             success: true,
36562:             posted: true,
36563:             published_post_id: publishedPostId,
36564:           }),
36565:           {
36566:             status: 200,
36567:             headers: { "content-type": "application/json; charset=UTF-8" },
36568:           },
36569:         );
36570:       }
36571: 
36572:       const publishErrorMessage = refreshed?.publish_error_message?.trim() || "scheduled_publish_retry_failed";
36573:       return new Response(
36574:         JSON.stringify({
36575:           success: false,
36576:           error: publishErrorMessage,
36577:           publish_error_message: publishErrorMessage,
36578:         }),
36579:         {
36580:           status: 502,
36581:           headers: { "content-type": "application/json; charset=UTF-8" },
36582:         },
36583:       );
36584:     }
36585: 
36586:     if (url.pathname === "/api/threads/schedule" && request.method === "GET") {
36587:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
36588:       const selectedThreadsUserId = url.searchParams.get("threads_user_id")?.trim() || null;
36589: 
36590:       const scheduledPostsTableExists = await doesTableExist(env, "scheduled_posts");
36591:       if (!scheduledPostsTableExists) {
36592:         return new Response(
36593:           JSON.stringify({
36594:             success: true,
36595:             scheduled_posts: [],
36596:           }),
36597:           {
36598:             status: 200,
36599:             headers: { "content-type": "application/json; charset=UTF-8" },
36600:           },
36601:         );
36602:       }
36603: 
36604:       await ensureScheduledPostsTable(env);
36605:       await recoverStalePostingScheduledPosts(env);
36606: 
36607:       const rows = await env.DB.prepare(
36608:         `SELECT id, post_text, status, scheduled_time, spoiler_all_text, spoiler_phrases_json, publish_error_message, last_attempted_at, processing_started_at
36609:          FROM scheduled_posts
36610:          WHERE user_id = ?
36611:            AND (? IS NULL OR threads_user_id = ?)
36612:            AND status IN (?, ?)
36613:          ORDER BY scheduled_time ASC, id ASC
36614:          LIMIT 100`,
36615:       )
36616:         .bind(
36617:           ownedAppUserId,
36618:           selectedThreadsUserId,
36619:           selectedThreadsUserId,
36620:           SCHEDULED_POST_STATUS_APPROVED,
36621:           SCHEDULED_POST_STATUS_POSTING,
36622:         )
36623:         .all<{
36624:           id: number | string;
36625:           post_text: string;
36626:           status: string;
36627:           scheduled_time: string;
36628:           spoiler_all_text: number | null;
36629:           spoiler_phrases_json: string | null;
36630:           publish_error_message: string | null;
36631:           last_attempted_at: string | null;
```

## /api/threads/schedule/batch

Web refs: lensically-web/components/BatchSchedulePanel.tsx:50

### Worker occurrence line 35721

```ts
35676:           publishScope,
35677:           ownedAppUserId,
35678:           account.threads_user_id,
35679:           requestHash,
35680:           requestBucket,
35681:           200,
35682:           responseBody,
35683:         );
35684:       } catch (error) {
35685:         if (!isUniqueConstraintError(error)) {
35686:           throw error;
35687:         }
35688: 
35689:         const racedResponse = await getImmediatePublishIdempotentResponse(
35690:           env,
35691:           publishScope,
35692:           ownedAppUserId,
35693:           account.threads_user_id,
35694:           requestHash,
35695:           requestBucket,
35696:         );
35697:         if (racedResponse) {
35698:           const racedStatus = typeof racedResponse.response_status === "number"
35699:             ? racedResponse.response_status
35700:             : 200;
35701:           return new Response(racedResponse.response_body, {
35702:             status: racedStatus,
35703:             headers: { "content-type": "application/json; charset=UTF-8" },
35704:           });
35705:         }
35706:       }
35707: 
35708:       if (url.pathname === "/api/threads/publish") {
35709:         return new Response(responseBody, {
35710:           status: 200,
35711:           headers: { "content-type": "application/json; charset=UTF-8" },
35712:         });
35713:       }
35714: 
35715:       return new Response(responseBody, {
35716:         status: 200,
35717:         headers: { "content-type": "application/json; charset=UTF-8" },
35718:       });
35719:     }
35720: 
35721:     if (url.pathname === "/api/threads/schedule/batch" && request.method === "POST") {
35722:       const authUser = await requireAuth(request, env);
35723:       if (authUser instanceof Response) {
35724:         return authUser;
35725:       }
35726: 
35727:       let payload: {
35728:         app_user_id?: string;
35729:         threads_user_id?: string;
35730:         timezone?: string;
35731:         date?: string;
35732:         entries?: Array<{
35733:           text?: string;
35734:           time?: string;
35735:           date?: string;
35736:           spoiler_all_text?: boolean;
35737:           spoiler_phrases?: string[];
35738:         }>;
35739:       };
35740:       try {
35741:         payload = await request.json();
35742:       } catch {
35743:         return new Response(
35744:           JSON.stringify({ error: "Invalid JSON body" }),
35745:           {
35746:             status: 400,
35747:             headers: { "content-type": "application/json; charset=UTF-8", ...requestCorsHeaders },
35748:           },
35749:         );
35750:       }
35751: 
35752:       const ownedAppUserId = payload.app_user_id?.trim() || authUser.id || WORKSPACE_APP_USER_ID;
35753:       const threadsUserId = payload.threads_user_id?.trim();
35754:       const timezone = payload.timezone?.trim() || WORKSPACE_DEFAULT_TIMEZONE;
35755:       const sharedDate = payload.date?.trim() || "";
35756:       const entries = Array.isArray(payload.entries) ? payload.entries : [];
35757: 
35758:       if (!threadsUserId || entries.length === 0 || entries.length > MAX_SCHEDULED_POST_MAX_BATCH_SIZE) {
35759:         return new Response(
35760:           JSON.stringify({ error: "threads_user_id and a non-empty entries array are required" }),
35761:           {
35762:             status: 400,
35763:             headers: { "content-type": "application/json; charset=UTF-8" },
35764:           },
35765:         );
35766:       }
```

## /api/threads/schedule/delete

Web refs: lensically-web/app/(internal)/scheduled-posts/page.tsx:69

### Worker occurrence line 36264

```ts
36219:           JSON.stringify({ error: "scheduled_post_id, text, date, and time are required" }),
36220:           {
36221:             status: 400,
36222:             headers: { "content-type": "application/json; charset=UTF-8" },
36223:           },
36224:         );
36225:       }
36226: 
36227:       const updated = await updateScheduledPostForAppUser(env, {
36228:         appUserId: WORKSPACE_APP_USER_ID,
36229:         scheduledPostId,
36230:         text,
36231:         date,
36232:         time,
36233:         timeZone: timezone,
36234:                 spoilerAllText: normalizeSpoilerFlag(payload.spoiler_all_text),
36235:         spoilerPhrases: normalizeSpoilerPhrasesInput(payload.spoiler_phrases),
36236:         ownerNote: normalizeOwnerNote(payload.owner_note),
36237:         editorType: "owner",
36238:         editSource: "ui",
36239:       });
36240:       if (!updated.success || !updated.scheduledPost) {
36241:         return new Response(
36242:           JSON.stringify({ error: updated.error ?? "Scheduled post could not be updated." }),
36243:           {
36244:             status: updated.statusCode,
36245:             headers: { "content-type": "application/json; charset=UTF-8" },
36246:           },
36247:         );
36248:       }
36249: 
36250:       return new Response(
36251:         JSON.stringify({
36252:           success: true,
36253:                     scheduled_post: updated.scheduledPost,
36254:           linked_drafts_updated: updated.linkedDraftsUpdated ?? 0,
36255:           revision: updated.revision ?? null,
36256:         }),
36257:         {
36258:           status: 200,
36259:           headers: { "content-type": "application/json; charset=UTF-8" },
36260:         },
36261:       );
36262:     }
36263: 
36264:         if (url.pathname === "/api/threads/schedule/delete" && request.method === "POST") {
36265:       let payload: {
36266:         app_user_id?: string;
36267:         scheduled_post_id?: number | string;
36268:                 threads_user_id?: string;
36269:         reason_code?: string;
36270:         reason_detail?: string;
36271:       };
36272:       try {
36273:         payload = await request.json();
36274:       } catch {
36275:         return new Response(
36276:           JSON.stringify({ error: "Invalid JSON body" }),
36277:           {
36278:             status: 400,
36279:             headers: { "content-type": "application/json; charset=UTF-8" },
36280:           },
36281:         );
36282:       }
36283: 
36284:             const scheduledPostId = Number(payload.scheduled_post_id);
36285:       const reasonCode = normalizeScheduledPostDeletionReasonCode(payload.reason_code);
36286:       const reasonDetail = normalizeOperatorText(payload.reason_detail, 8000, true);
36287:       if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0) {
36288:         return new Response(
36289:           JSON.stringify({ error: "scheduled_post_id is required" }),
36290:           {
36291:             status: 400,
36292:             headers: { "content-type": "application/json; charset=UTF-8" },
36293:           },
36294:         );
36295:       }
36296:             if (!reasonCode) {
36297:         return new Response(
36298:           JSON.stringify({ error: "A valid deletion reason code is required.", allowed_reason_codes: SCHEDULED_POST_DELETION_REASON_CODES }),
36299:           { status: 400, headers: { "content-type": "application/json; charset=UTF-8" } },
36300:         );
36301:       }
36302: 
36303:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
36304:       const deleted = await deleteScheduledPostForAppUser(env, ownedAppUserId, scheduledPostId, {
36305:                 expectedThreadsUserId: normalizeOperatorText(payload.threads_user_id, 200, true),
36306:         reasonCode,
36307:         reasonDetail,
36308:         deletedBy: "owner",
36309:         deletionSource: "ui",
```

## /api/threads/schedule/retry

Web refs: lensically-web/app/(internal)/scheduled-posts/page.tsx:68

### Worker occurrence line 36447

```ts
36402:       const brand = await resolveGptBrandForThreadsUserId(env, scheduledPost.threads_user_id);
36403:       if (!brand) {
36404:         return new Response(
36405:           JSON.stringify({ error: "Configured Threads account not found" }),
36406:           {
36407:             status: 404,
36408:             headers: { "content-type": "application/json; charset=UTF-8" },
36409:           },
36410:         );
36411:       }
36412:       const strategy: GptPostStrategyInput = {
36413:         pillar: normalizeGptMemoryText(payload.pillar, 120, true),
36414:         hook_style: normalizeGptMemoryText(payload.hook_style, 120, true),
36415:         format: normalizeGptMemoryText(payload.format, 120, true),
36416:         intent: normalizeGptMemoryText(payload.intent, 120, true),
36417:         experiment: normalizeGptMemoryText(payload.experiment, 200, true),
36418:         novelty_level: normalizeGptMemoryText(payload.novelty_level, 80, true),
36419:         metadata_json: normalizeGptMemoryMetadata({
36420:           source: "lensically_scheduled_posts",
36421:           flexible_note: "Tags are descriptive signals for growth review, not rigid creative categories.",
36422:           ...(payload.metadata && typeof payload.metadata === "object" && !Array.isArray(payload.metadata)
36423:             ? payload.metadata
36424:             : {}),
36425:         }),
36426:       };
36427:       await upsertGptPostStrategyTag(env, {
36428:         scheduledPostId,
36429:         accountId: brand.account_id,
36430:         threadsUserId: scheduledPost.threads_user_id,
36431:         strategy,
36432:       });
36433:       const tagMap = await listGptPostStrategyTagsForScheduledPosts(env, [scheduledPostId]);
36434:       return new Response(
36435:         JSON.stringify({
36436:           success: true,
36437:           scheduled_post_id: scheduledPostId,
36438:           strategy: tagMap.get(scheduledPostId) ?? null,
36439:         }),
36440:         {
36441:           status: 200,
36442:           headers: { "content-type": "application/json; charset=UTF-8" },
36443:         },
36444:       );
36445:     }
36446: 
36447:     if (url.pathname === "/api/threads/schedule/retry" && request.method === "POST") {
36448:       let payload: {
36449:         app_user_id?: string;
36450:         scheduled_post_id?: number | string;
36451:       };
36452:       try {
36453:         payload = await request.json();
36454:       } catch {
36455:         return new Response(
36456:           JSON.stringify({ error: "Invalid JSON body" }),
36457:           {
36458:             status: 400,
36459:             headers: { "content-type": "application/json; charset=UTF-8" },
36460:           },
36461:         );
36462:       }
36463: 
36464:       const scheduledPostId = Number(payload.scheduled_post_id);
36465:       if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0) {
36466:         return new Response(
36467:           JSON.stringify({ error: "scheduled_post_id is required" }),
36468:           {
36469:             status: 400,
36470:             headers: { "content-type": "application/json; charset=UTF-8" },
36471:           },
36472:         );
36473:       }
36474: 
36475:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
36476: 
36477:       await ensureScheduledPostsTable(env);
36478:       const scheduledPost = await env.DB.prepare(
36479:         `SELECT id, user_id, threads_user_id, post_text, status, spoiler_all_text, spoiler_phrases_json
36480:          FROM scheduled_posts
36481:          WHERE id = ?
36482:            AND user_id = ?
36483:          LIMIT 1`,
36484:       )
36485:         .bind(scheduledPostId, ownedAppUserId)
36486:         .first<{
36487:           id: number | string;
36488:           user_id: string;
36489:           threads_user_id: string;
36490:           post_text: string;
36491:           status: string;
36492:           spoiler_all_text: number | null;
```

## /api/threads/schedule/strategy

Web refs: lensically-web/app/(internal)/scheduled-posts/page.tsx:70

### Worker occurrence line 36347

```ts
36302: 
36303:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
36304:       const deleted = await deleteScheduledPostForAppUser(env, ownedAppUserId, scheduledPostId, {
36305:                 expectedThreadsUserId: normalizeOperatorText(payload.threads_user_id, 200, true),
36306:         reasonCode,
36307:         reasonDetail,
36308:         deletedBy: "owner",
36309:         deletionSource: "ui",
36310:       });
36311:       if (deleted.outcome === "not_found") {
36312:         return new Response(
36313:           JSON.stringify({ error: "Scheduled post not found" }),
36314:           {
36315:             status: 404,
36316:             headers: { "content-type": "application/json; charset=UTF-8" },
36317:           },
36318:         );
36319:       }
36320: 
36321:       if (deleted.outcome === "not_deletable") {
36322:         return new Response(
36323:           JSON.stringify({ error: "Only approved scheduled posts can be deleted." }),
36324:           {
36325:             status: 409,
36326:             headers: { "content-type": "application/json; charset=UTF-8" },
36327:           },
36328:         );
36329:       }
36330: 
36331:       return new Response(
36332:         JSON.stringify({
36333:           success: true,
36334:           deleted: true,
36335:           scheduled_post_id: scheduledPostId,
36336:           deletion: deleted.record ?? null,
36337:           strategy_memory_written: false,
36338:         }),
36339:         {
36340:           status: 200,
36341:           headers: { "content-type": "application/json; charset=UTF-8" },
36342:         },
36343:       );
36344:     }
36345: 
36346: 
36347:     if (url.pathname === "/api/threads/schedule/strategy" && request.method === "POST") {
36348:       let payload: {
36349:         scheduled_post_id?: number | string;
36350:         pillar?: string | null;
36351:         hook_style?: string | null;
36352:         format?: string | null;
36353:         intent?: string | null;
36354:         experiment?: string | null;
36355:         novelty_level?: string | null;
36356:         metadata?: unknown;
36357:       };
36358:       try {
36359:         payload = await request.json();
36360:       } catch {
36361:         return new Response(
36362:           JSON.stringify({ error: "Invalid JSON body" }),
36363:           {
36364:             status: 400,
36365:             headers: { "content-type": "application/json; charset=UTF-8" },
36366:           },
36367:         );
36368:       }
36369: 
36370:       const scheduledPostId = Number(payload.scheduled_post_id);
36371:       if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0) {
36372:         return new Response(
36373:           JSON.stringify({ error: "scheduled_post_id is required" }),
36374:           {
36375:             status: 400,
36376:             headers: { "content-type": "application/json; charset=UTF-8" },
36377:           },
36378:         );
36379:       }
36380: 
36381:       await ensureScheduledPostsTable(env);
36382:       const ownedAppUserId = WORKSPACE_APP_USER_ID;
36383:       const scheduledPost = await env.DB.prepare(
36384:         `SELECT id, threads_user_id
36385:          FROM scheduled_posts
36386:          WHERE id = ?
36387:            AND user_id = ?
36388:          LIMIT 1`,
36389:       )
36390:         .bind(scheduledPostId, ownedAppUserId)
36391:         .first<{ id: number | string; threads_user_id: string }>();
36392:       if (!scheduledPost?.threads_user_id) {
```

## /api/threads/schedule/update

Web refs: lensically-web/app/(internal)/scheduled-posts/page.tsx:67

### Worker occurrence line 36188

```ts
36143:         });
36144:         return new Response(
36145:           JSON.stringify({
36146:             success: true,
36147:             scheduled_post: {
36148:               id: Number(racedScheduledPost.id),
36149:               status: racedScheduledPost.status,
36150:               scheduled_time_utc: racedScheduledPost.scheduled_time,
36151:               spoiler_all_text: spoilerAllText,
36152:               spoiler_phrases: spoilerPhrases,
36153:             },
36154:           }),
36155:           {
36156:             status: 200,
36157:             headers: { "content-type": "application/json; charset=UTF-8" },
36158:           },
36159:         );
36160:       }
36161: 
36162:       logWorkerEvent("SCHEDULED_POST_CREATED", {
36163:         scheduled_post_id: insertedScheduledPostId,
36164:         user_id: ownedAppUserId,
36165:         threads_user_id: threadsUserId,
36166:         idempotent_reuse: false,
36167:         status: SCHEDULED_POST_STATUS_APPROVED,
36168:       });
36169: 
36170:       return new Response(
36171:         JSON.stringify({
36172:           success: true,
36173:           scheduled_post: {
36174:             id: insertedScheduledPostId,
36175:             status: SCHEDULED_POST_STATUS_APPROVED,
36176:             scheduled_time_utc: scheduledUtc,
36177:             spoiler_all_text: spoilerAllText,
36178:             spoiler_phrases: spoilerPhrases,
36179:           },
36180:         }),
36181:         {
36182:           status: 200,
36183:           headers: { "content-type": "application/json; charset=UTF-8" },
36184:         },
36185:       );
36186:     }
36187: 
36188:         if (url.pathname === "/api/threads/schedule/update" && request.method === "POST") {
36189:       let payload: {
36190:         app_user_id?: string;
36191:         scheduled_post_id?: number | string;
36192:         text?: string;
36193:         date?: string;
36194:         time?: string;
36195:         timezone?: string;
36196:         spoiler_all_text?: boolean;
36197:         spoiler_phrases?: string[];
36198:         owner_note?: string;
36199:       };
36200:       try {
36201:         payload = await request.json();
36202:       } catch {
36203:         return new Response(
36204:           JSON.stringify({ error: "Invalid JSON body" }),
36205:           {
36206:             status: 400,
36207:             headers: { "content-type": "application/json; charset=UTF-8" },
36208:           },
36209:         );
36210:       }
36211: 
36212:             const scheduledPostId = Number(payload.scheduled_post_id);
36213:       const text = payload.text?.trim();
36214:       const date = payload.date?.trim();
36215:       const time = payload.time?.trim();
36216:       const timezone = payload.timezone?.trim() || WORKSPACE_DEFAULT_TIMEZONE;
36217:       if (!Number.isInteger(scheduledPostId) || scheduledPostId <= 0 || !text || !date || !time) {
36218:         return new Response(
36219:           JSON.stringify({ error: "scheduled_post_id, text, date, and time are required" }),
36220:           {
36221:             status: 400,
36222:             headers: { "content-type": "application/json; charset=UTF-8" },
36223:           },
36224:         );
36225:       }
36226: 
36227:       const updated = await updateScheduledPostForAppUser(env, {
36228:         appUserId: WORKSPACE_APP_USER_ID,
36229:         scheduledPostId,
36230:         text,
36231:         date,
36232:         time,
36233:         timeZone: timezone,
```


# Background Cron Evidence

## * * * * *

### line 421

```ts
371:   getManifestIntelligenceEngineState,
372:   refreshManifestIntelligenceEngine,
373:   registerManifestExperimentAssignment,
374:   upsertManifestSemanticSignature,
375: } from "./manifestIntelligenceEngine";
376: import {
377:   buildManifestMeasurementAuditRead,
378:     ensureManifestMeasurementAuditTables,
379:   refreshManifestMeasurementAudit,
380:   refreshManifestSavedPatternIntelligence,
381:   type ManifestAuditSection,
382: } from "./manifestMeasurementAudit";
383: import {
384:   buildManifestDecisionIntelligence,
385:   buildManifestIntelligenceDashboard,
386:   ensureManifestProductIntegrationTables,
387:   recordManifestDecisionInfluence,
388: } from "./manifestProductIntegration";
389: import {
390:   SOURCE_FAMILY_LABEL_POLICY_VERSION,
391:   SOURCE_SELECTION_ENGINE_VERSION,
392:     enrichSourceCandidatesForSelection,
393:   ensureSourceFamilySelectionTables,
394:                                 loadLockedSourceCardSelectionCandidates,
395:   loadSourceLabelAllocationState,
396:   normalizeSourceFamilyLifetimeLabel,
397: 
398: 
399: 
400:     persistLockedSourceSelectionPlan,
401: 
402:   readLockedSourceSelectionPlan,
403: 
404:   refreshSourceFamilyLabels,
405:   runSourceFamilySelectionEdgeCases,
406:   selectSourceFamilyLineup,
407:   validateLineupAgainstLockedSourceSelectionPlan,
408: } from "./sourceFamilySelection";
409: 
410: 
411: const DEFAULT_APP_URL = "https://app.lensically.com";
412: const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
413: const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";
414: const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
415: const SCHEDULED_POST_STATUS_APPROVED = "approved";
416: const SCHEDULED_POST_STATUS_POSTING = "posting";
417: const SCHEDULED_POST_STATUS_POSTED = "posted";
418: const DEFAULT_SCHEDULED_POST_MAX_BATCH_SIZE = 25;
419: const MAX_SCHEDULED_POST_MAX_BATCH_SIZE = 100;
420: const SCHEDULED_POST_STALE_POSTING_WINDOW_MS = 3 * 60 * 1000;
421: const SCHEDULED_POST_PUBLISH_CRON = "* * * * *";
422: const SCHEDULED_POST_ALARM_INTERVAL_MS = 60 * 1000;
423: const SCHEDULED_POST_ALARM_OBJECT_NAME = "scheduled-post-publisher";
424: const THREADS_TOKEN_REFRESH_CRON = "0 */12 * * *";
425: const LEGACY_COMBINED_SCHEDULED_CRON = "0 3 * * *";
426: const THREADS_FOLLOWER_START_OF_DAY_CRON = "1 4,5 * * *";
427: const THREADS_INSIGHTS_SIX_HOUR_WINDOW_CRON = "0 * * * *";
428: const THREADS_INSIGHTS_TIME_ZONE = "America/New_York";
429: const THREADS_FOLLOWER_START_OF_DAY_HOUR = 0;
430: const THREADS_FOLLOWER_START_OF_DAY_MINUTE = 1;
431: const THREADS_INSIGHTS_TARGET_HOURS = new Set([0, 6, 12, 18]);
432: const THREADS_INSIGHTS_TARGET_MINUTE = 0;
433: const THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS = 30;
434: const MAX_THREADS_POST_CURSOR_DEPTH = 250;
435: const IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
436: const THREADS_CONNECTION_TOMBSTONE_WINDOW_MS = 24 * 60 * 60 * 1000;
437: const WORKSPACE_APP_USER_ID = "workspace-owner";
438: const SAVED_PATTERNS_APP_USER_ID = "lensically";
439: const WORKSPACE_IS_ADMIN = true;
440: const WORKSPACE_DEFAULT_TIMEZONE = "America/New_York";
441: const MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH = 80;
442: const MAX_BATCH_SCHEDULE_PRESET_COUNT = 50;
443: const MAX_BATCH_SCHEDULE_PRESET_SLOTS = 50;
444: const HERMES_DEFAULT_MODEL = "gpt-5.5";
445: const HERMES_MAX_POST_COUNT = 50;
446: const HERMES_CONTEXT_ARCHIVE_LIMIT = 48;
447: const HERMES_CONTEXT_PATTERN_LIMIT = 48;
448: const DASHBOARD_TIME_ZONE = "America/New_York";
449: const DASHBOARD_FOLLOWER_SNAPSHOT_RETENTION_DAYS = 45;
450: const DASHBOARD_HIT_RATE_LIKES_THRESHOLD = 30;
451: const DASHBOARD_WEAK_POST_VIEWS_THRESHOLD = 100;
452: const DASHBOARD_WEAK_POST_VIEWS_HOURS = 6;
453: const DASHBOARD_WEAK_POST_ZERO_LIKES_HOURS = 3;
454: const DASHBOARD_POST_PREVIEW_LENGTH = 140;
455: const DASHBOARD_RECENT_POST_LIMIT = 250;
456: const DASHBOARD_WINNING_TERM_LIMIT = 8;
457: const DASHBOARD_WINNING_PHRASE_LIMIT = 5;
458: const DASHBOARD_FATIGUE_WORD_LIMIT = 6;
459: const DASHBOARD_STOP_WORDS = new Set([
460:   "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
461:   "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our",
462:   "so", "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "will",
463:   "with", "you", "your",
464: ]);
465: 
466: interface Env {
467:   THREADS_CLIENT_ID: string;
468:   THREADS_CLIENT_SECRET: string;
469:   INTERNAL_API_KEY: string;
470:   LENSICALLY_GPT_API_KEY?: string;
471:   LENSICALLY_MCP_ACCESS_TOKEN?: string;
```

## 0 */12 * * *

### line 424

```ts
374:   upsertManifestSemanticSignature,
375: } from "./manifestIntelligenceEngine";
376: import {
377:   buildManifestMeasurementAuditRead,
378:     ensureManifestMeasurementAuditTables,
379:   refreshManifestMeasurementAudit,
380:   refreshManifestSavedPatternIntelligence,
381:   type ManifestAuditSection,
382: } from "./manifestMeasurementAudit";
383: import {
384:   buildManifestDecisionIntelligence,
385:   buildManifestIntelligenceDashboard,
386:   ensureManifestProductIntegrationTables,
387:   recordManifestDecisionInfluence,
388: } from "./manifestProductIntegration";
389: import {
390:   SOURCE_FAMILY_LABEL_POLICY_VERSION,
391:   SOURCE_SELECTION_ENGINE_VERSION,
392:     enrichSourceCandidatesForSelection,
393:   ensureSourceFamilySelectionTables,
394:                                 loadLockedSourceCardSelectionCandidates,
395:   loadSourceLabelAllocationState,
396:   normalizeSourceFamilyLifetimeLabel,
397: 
398: 
399: 
400:     persistLockedSourceSelectionPlan,
401: 
402:   readLockedSourceSelectionPlan,
403: 
404:   refreshSourceFamilyLabels,
405:   runSourceFamilySelectionEdgeCases,
406:   selectSourceFamilyLineup,
407:   validateLineupAgainstLockedSourceSelectionPlan,
408: } from "./sourceFamilySelection";
409: 
410: 
411: const DEFAULT_APP_URL = "https://app.lensically.com";
412: const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
413: const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";
414: const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
415: const SCHEDULED_POST_STATUS_APPROVED = "approved";
416: const SCHEDULED_POST_STATUS_POSTING = "posting";
417: const SCHEDULED_POST_STATUS_POSTED = "posted";
418: const DEFAULT_SCHEDULED_POST_MAX_BATCH_SIZE = 25;
419: const MAX_SCHEDULED_POST_MAX_BATCH_SIZE = 100;
420: const SCHEDULED_POST_STALE_POSTING_WINDOW_MS = 3 * 60 * 1000;
421: const SCHEDULED_POST_PUBLISH_CRON = "* * * * *";
422: const SCHEDULED_POST_ALARM_INTERVAL_MS = 60 * 1000;
423: const SCHEDULED_POST_ALARM_OBJECT_NAME = "scheduled-post-publisher";
424: const THREADS_TOKEN_REFRESH_CRON = "0 */12 * * *";
425: const LEGACY_COMBINED_SCHEDULED_CRON = "0 3 * * *";
426: const THREADS_FOLLOWER_START_OF_DAY_CRON = "1 4,5 * * *";
427: const THREADS_INSIGHTS_SIX_HOUR_WINDOW_CRON = "0 * * * *";
428: const THREADS_INSIGHTS_TIME_ZONE = "America/New_York";
429: const THREADS_FOLLOWER_START_OF_DAY_HOUR = 0;
430: const THREADS_FOLLOWER_START_OF_DAY_MINUTE = 1;
431: const THREADS_INSIGHTS_TARGET_HOURS = new Set([0, 6, 12, 18]);
432: const THREADS_INSIGHTS_TARGET_MINUTE = 0;
433: const THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS = 30;
434: const MAX_THREADS_POST_CURSOR_DEPTH = 250;
435: const IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
436: const THREADS_CONNECTION_TOMBSTONE_WINDOW_MS = 24 * 60 * 60 * 1000;
437: const WORKSPACE_APP_USER_ID = "workspace-owner";
438: const SAVED_PATTERNS_APP_USER_ID = "lensically";
439: const WORKSPACE_IS_ADMIN = true;
440: const WORKSPACE_DEFAULT_TIMEZONE = "America/New_York";
441: const MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH = 80;
442: const MAX_BATCH_SCHEDULE_PRESET_COUNT = 50;
443: const MAX_BATCH_SCHEDULE_PRESET_SLOTS = 50;
444: const HERMES_DEFAULT_MODEL = "gpt-5.5";
445: const HERMES_MAX_POST_COUNT = 50;
446: const HERMES_CONTEXT_ARCHIVE_LIMIT = 48;
447: const HERMES_CONTEXT_PATTERN_LIMIT = 48;
448: const DASHBOARD_TIME_ZONE = "America/New_York";
449: const DASHBOARD_FOLLOWER_SNAPSHOT_RETENTION_DAYS = 45;
450: const DASHBOARD_HIT_RATE_LIKES_THRESHOLD = 30;
451: const DASHBOARD_WEAK_POST_VIEWS_THRESHOLD = 100;
452: const DASHBOARD_WEAK_POST_VIEWS_HOURS = 6;
453: const DASHBOARD_WEAK_POST_ZERO_LIKES_HOURS = 3;
454: const DASHBOARD_POST_PREVIEW_LENGTH = 140;
455: const DASHBOARD_RECENT_POST_LIMIT = 250;
456: const DASHBOARD_WINNING_TERM_LIMIT = 8;
457: const DASHBOARD_WINNING_PHRASE_LIMIT = 5;
458: const DASHBOARD_FATIGUE_WORD_LIMIT = 6;
459: const DASHBOARD_STOP_WORDS = new Set([
460:   "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
461:   "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our",
462:   "so", "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "will",
463:   "with", "you", "your",
464: ]);
465: 
466: interface Env {
467:   THREADS_CLIENT_ID: string;
468:   THREADS_CLIENT_SECRET: string;
469:   INTERNAL_API_KEY: string;
470:   LENSICALLY_GPT_API_KEY?: string;
471:   LENSICALLY_MCP_ACCESS_TOKEN?: string;
472:   LENSICALLY_MCP_OAUTH_CLIENT_ID?: string;
473:   LENSICALLY_MCP_OAUTH_CLIENT_SECRET?: string;
474:   LENSICALLY_MCP_OAUTH_REDIRECT_URI?: string;
```

## 1 4,5 * * *

### line 426

```ts
376: import {
377:   buildManifestMeasurementAuditRead,
378:     ensureManifestMeasurementAuditTables,
379:   refreshManifestMeasurementAudit,
380:   refreshManifestSavedPatternIntelligence,
381:   type ManifestAuditSection,
382: } from "./manifestMeasurementAudit";
383: import {
384:   buildManifestDecisionIntelligence,
385:   buildManifestIntelligenceDashboard,
386:   ensureManifestProductIntegrationTables,
387:   recordManifestDecisionInfluence,
388: } from "./manifestProductIntegration";
389: import {
390:   SOURCE_FAMILY_LABEL_POLICY_VERSION,
391:   SOURCE_SELECTION_ENGINE_VERSION,
392:     enrichSourceCandidatesForSelection,
393:   ensureSourceFamilySelectionTables,
394:                                 loadLockedSourceCardSelectionCandidates,
395:   loadSourceLabelAllocationState,
396:   normalizeSourceFamilyLifetimeLabel,
397: 
398: 
399: 
400:     persistLockedSourceSelectionPlan,
401: 
402:   readLockedSourceSelectionPlan,
403: 
404:   refreshSourceFamilyLabels,
405:   runSourceFamilySelectionEdgeCases,
406:   selectSourceFamilyLineup,
407:   validateLineupAgainstLockedSourceSelectionPlan,
408: } from "./sourceFamilySelection";
409: 
410: 
411: const DEFAULT_APP_URL = "https://app.lensically.com";
412: const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
413: const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";
414: const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
415: const SCHEDULED_POST_STATUS_APPROVED = "approved";
416: const SCHEDULED_POST_STATUS_POSTING = "posting";
417: const SCHEDULED_POST_STATUS_POSTED = "posted";
418: const DEFAULT_SCHEDULED_POST_MAX_BATCH_SIZE = 25;
419: const MAX_SCHEDULED_POST_MAX_BATCH_SIZE = 100;
420: const SCHEDULED_POST_STALE_POSTING_WINDOW_MS = 3 * 60 * 1000;
421: const SCHEDULED_POST_PUBLISH_CRON = "* * * * *";
422: const SCHEDULED_POST_ALARM_INTERVAL_MS = 60 * 1000;
423: const SCHEDULED_POST_ALARM_OBJECT_NAME = "scheduled-post-publisher";
424: const THREADS_TOKEN_REFRESH_CRON = "0 */12 * * *";
425: const LEGACY_COMBINED_SCHEDULED_CRON = "0 3 * * *";
426: const THREADS_FOLLOWER_START_OF_DAY_CRON = "1 4,5 * * *";
427: const THREADS_INSIGHTS_SIX_HOUR_WINDOW_CRON = "0 * * * *";
428: const THREADS_INSIGHTS_TIME_ZONE = "America/New_York";
429: const THREADS_FOLLOWER_START_OF_DAY_HOUR = 0;
430: const THREADS_FOLLOWER_START_OF_DAY_MINUTE = 1;
431: const THREADS_INSIGHTS_TARGET_HOURS = new Set([0, 6, 12, 18]);
432: const THREADS_INSIGHTS_TARGET_MINUTE = 0;
433: const THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS = 30;
434: const MAX_THREADS_POST_CURSOR_DEPTH = 250;
435: const IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
436: const THREADS_CONNECTION_TOMBSTONE_WINDOW_MS = 24 * 60 * 60 * 1000;
437: const WORKSPACE_APP_USER_ID = "workspace-owner";
438: const SAVED_PATTERNS_APP_USER_ID = "lensically";
439: const WORKSPACE_IS_ADMIN = true;
440: const WORKSPACE_DEFAULT_TIMEZONE = "America/New_York";
441: const MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH = 80;
442: const MAX_BATCH_SCHEDULE_PRESET_COUNT = 50;
443: const MAX_BATCH_SCHEDULE_PRESET_SLOTS = 50;
444: const HERMES_DEFAULT_MODEL = "gpt-5.5";
445: const HERMES_MAX_POST_COUNT = 50;
446: const HERMES_CONTEXT_ARCHIVE_LIMIT = 48;
447: const HERMES_CONTEXT_PATTERN_LIMIT = 48;
448: const DASHBOARD_TIME_ZONE = "America/New_York";
449: const DASHBOARD_FOLLOWER_SNAPSHOT_RETENTION_DAYS = 45;
450: const DASHBOARD_HIT_RATE_LIKES_THRESHOLD = 30;
451: const DASHBOARD_WEAK_POST_VIEWS_THRESHOLD = 100;
452: const DASHBOARD_WEAK_POST_VIEWS_HOURS = 6;
453: const DASHBOARD_WEAK_POST_ZERO_LIKES_HOURS = 3;
454: const DASHBOARD_POST_PREVIEW_LENGTH = 140;
455: const DASHBOARD_RECENT_POST_LIMIT = 250;
456: const DASHBOARD_WINNING_TERM_LIMIT = 8;
457: const DASHBOARD_WINNING_PHRASE_LIMIT = 5;
458: const DASHBOARD_FATIGUE_WORD_LIMIT = 6;
459: const DASHBOARD_STOP_WORDS = new Set([
460:   "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
461:   "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our",
462:   "so", "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "will",
463:   "with", "you", "your",
464: ]);
465: 
466: interface Env {
467:   THREADS_CLIENT_ID: string;
468:   THREADS_CLIENT_SECRET: string;
469:   INTERNAL_API_KEY: string;
470:   LENSICALLY_GPT_API_KEY?: string;
471:   LENSICALLY_MCP_ACCESS_TOKEN?: string;
472:   LENSICALLY_MCP_OAUTH_CLIENT_ID?: string;
473:   LENSICALLY_MCP_OAUTH_CLIENT_SECRET?: string;
474:   LENSICALLY_MCP_OAUTH_REDIRECT_URI?: string;
475:     LENSICALLY_COMMIT_SHA?: string;
476:   LENSICALLY_STRIPE_KEY?: string;
```

## 0 * * * *

### line 427

```ts
377:   buildManifestMeasurementAuditRead,
378:     ensureManifestMeasurementAuditTables,
379:   refreshManifestMeasurementAudit,
380:   refreshManifestSavedPatternIntelligence,
381:   type ManifestAuditSection,
382: } from "./manifestMeasurementAudit";
383: import {
384:   buildManifestDecisionIntelligence,
385:   buildManifestIntelligenceDashboard,
386:   ensureManifestProductIntegrationTables,
387:   recordManifestDecisionInfluence,
388: } from "./manifestProductIntegration";
389: import {
390:   SOURCE_FAMILY_LABEL_POLICY_VERSION,
391:   SOURCE_SELECTION_ENGINE_VERSION,
392:     enrichSourceCandidatesForSelection,
393:   ensureSourceFamilySelectionTables,
394:                                 loadLockedSourceCardSelectionCandidates,
395:   loadSourceLabelAllocationState,
396:   normalizeSourceFamilyLifetimeLabel,
397: 
398: 
399: 
400:     persistLockedSourceSelectionPlan,
401: 
402:   readLockedSourceSelectionPlan,
403: 
404:   refreshSourceFamilyLabels,
405:   runSourceFamilySelectionEdgeCases,
406:   selectSourceFamilyLineup,
407:   validateLineupAgainstLockedSourceSelectionPlan,
408: } from "./sourceFamilySelection";
409: 
410: 
411: const DEFAULT_APP_URL = "https://app.lensically.com";
412: const DEFAULT_ROOT_SITE_URL = "https://lensically.com";
413: const DEFAULT_WORKER_ORIGIN = "https://api.lensically.com";
414: const LOCAL_DEV_HOSTS = new Set(["localhost", "127.0.0.1"]);
415: const SCHEDULED_POST_STATUS_APPROVED = "approved";
416: const SCHEDULED_POST_STATUS_POSTING = "posting";
417: const SCHEDULED_POST_STATUS_POSTED = "posted";
418: const DEFAULT_SCHEDULED_POST_MAX_BATCH_SIZE = 25;
419: const MAX_SCHEDULED_POST_MAX_BATCH_SIZE = 100;
420: const SCHEDULED_POST_STALE_POSTING_WINDOW_MS = 3 * 60 * 1000;
421: const SCHEDULED_POST_PUBLISH_CRON = "* * * * *";
422: const SCHEDULED_POST_ALARM_INTERVAL_MS = 60 * 1000;
423: const SCHEDULED_POST_ALARM_OBJECT_NAME = "scheduled-post-publisher";
424: const THREADS_TOKEN_REFRESH_CRON = "0 */12 * * *";
425: const LEGACY_COMBINED_SCHEDULED_CRON = "0 3 * * *";
426: const THREADS_FOLLOWER_START_OF_DAY_CRON = "1 4,5 * * *";
427: const THREADS_INSIGHTS_SIX_HOUR_WINDOW_CRON = "0 * * * *";
428: const THREADS_INSIGHTS_TIME_ZONE = "America/New_York";
429: const THREADS_FOLLOWER_START_OF_DAY_HOUR = 0;
430: const THREADS_FOLLOWER_START_OF_DAY_MINUTE = 1;
431: const THREADS_INSIGHTS_TARGET_HOURS = new Set([0, 6, 12, 18]);
432: const THREADS_INSIGHTS_TARGET_MINUTE = 0;
433: const THREADS_INSIGHTS_CACHE_MAX_AGE_HOURS = 30;
434: const MAX_THREADS_POST_CURSOR_DEPTH = 250;
435: const IMMEDIATE_PUBLISH_IDEMPOTENCY_WINDOW_MS = 10 * 60 * 1000;
436: const THREADS_CONNECTION_TOMBSTONE_WINDOW_MS = 24 * 60 * 60 * 1000;
437: const WORKSPACE_APP_USER_ID = "workspace-owner";
438: const SAVED_PATTERNS_APP_USER_ID = "lensically";
439: const WORKSPACE_IS_ADMIN = true;
440: const WORKSPACE_DEFAULT_TIMEZONE = "America/New_York";
441: const MAX_BATCH_SCHEDULE_PRESET_NAME_LENGTH = 80;
442: const MAX_BATCH_SCHEDULE_PRESET_COUNT = 50;
443: const MAX_BATCH_SCHEDULE_PRESET_SLOTS = 50;
444: const HERMES_DEFAULT_MODEL = "gpt-5.5";
445: const HERMES_MAX_POST_COUNT = 50;
446: const HERMES_CONTEXT_ARCHIVE_LIMIT = 48;
447: const HERMES_CONTEXT_PATTERN_LIMIT = 48;
448: const DASHBOARD_TIME_ZONE = "America/New_York";
449: const DASHBOARD_FOLLOWER_SNAPSHOT_RETENTION_DAYS = 45;
450: const DASHBOARD_HIT_RATE_LIKES_THRESHOLD = 30;
451: const DASHBOARD_WEAK_POST_VIEWS_THRESHOLD = 100;
452: const DASHBOARD_WEAK_POST_VIEWS_HOURS = 6;
453: const DASHBOARD_WEAK_POST_ZERO_LIKES_HOURS = 3;
454: const DASHBOARD_POST_PREVIEW_LENGTH = 140;
455: const DASHBOARD_RECENT_POST_LIMIT = 250;
456: const DASHBOARD_WINNING_TERM_LIMIT = 8;
457: const DASHBOARD_WINNING_PHRASE_LIMIT = 5;
458: const DASHBOARD_FATIGUE_WORD_LIMIT = 6;
459: const DASHBOARD_STOP_WORDS = new Set([
460:   "a", "an", "and", "are", "as", "at", "be", "been", "but", "by", "for", "from", "had", "has", "have",
461:   "he", "her", "his", "i", "if", "in", "into", "is", "it", "its", "me", "my", "of", "on", "or", "our",
462:   "so", "that", "the", "their", "them", "there", "they", "this", "to", "was", "we", "were", "will",
463:   "with", "you", "your",
464: ]);
465: 
466: interface Env {
467:   THREADS_CLIENT_ID: string;
468:   THREADS_CLIENT_SECRET: string;
469:   INTERNAL_API_KEY: string;
470:   LENSICALLY_GPT_API_KEY?: string;
471:   LENSICALLY_MCP_ACCESS_TOKEN?: string;
472:   LENSICALLY_MCP_OAUTH_CLIENT_ID?: string;
473:   LENSICALLY_MCP_OAUTH_CLIENT_SECRET?: string;
474:   LENSICALLY_MCP_OAUTH_REDIRECT_URI?: string;
475:     LENSICALLY_COMMIT_SHA?: string;
476:   LENSICALLY_STRIPE_KEY?: string;
477:   CF_VERSION_METADATA?: { id?: string; tag?: string; timestamp?: string };
```

