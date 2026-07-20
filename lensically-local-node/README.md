# Lensically Local Execution Node

This package installs a Windows-only outbound polling node for Lensically validation and engineering jobs.

The node never opens an inbound port. The bootstrap service polls Lensically over HTTPS, verifies signed bounded jobs, launches the active worker package, reports heartbeats and receipts, and can install a candidate worker into the inactive slot after local commissioning checks.

One-time elevated installation:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -NodeId brian-win-node -LensicallyOrigin https://api.lensically.com
```

Set the same generated `device_secret` value as the production Worker secret `LENSICALLY_LOCAL_NODE_SECRET` before issuing jobs to the node. The secret authenticates heartbeat, poll, job-verification, and result requests; job payloads are still separately verified with server-signed exact-SHA envelopes.

The installer verifies prerequisites, creates active/previous worker slots under `%ProgramData%\Lensically\LocalExecutionNode`, registers the Windows service, and starts it.
