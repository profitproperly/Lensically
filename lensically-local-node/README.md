# Lensically Local Execution Node

This package installs a Windows-only outbound polling node for Lensically validation and engineering jobs.

The node never opens an inbound port. A boot-time Windows Scheduled Task runs the immutable bootstrap as `SYSTEM`, polls Lensically over HTTPS, verifies signed bounded jobs, launches the active worker package, reports heartbeats and receipts, and can install a candidate worker into the inactive slot after local commissioning checks.

One-time elevated installation after Main creates a short-lived single-use enrollment token:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Install -NodeId brian-win-node -LensicallyOrigin https://api.lensically.com -EnrollmentToken <single-use-token>
```

The installer generates a per-device credential locally and enrolls it with the single-use token. Main stores only the credential hash. Future heartbeat, poll, job-verification, and result requests authenticate the exact node with that per-node credential; job payloads are still separately verified with server-signed exact-SHA envelopes.

No device secret is committed to Git, and no ordinary future worker update requires editing Cloudflare secrets or touching the PC. The bootstrap root of trust remains `service.mjs`; remotely replaceable worker logic lives only in the active/previous worker slots.

Repair, commissioning, and uninstall:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Repair -NodeId brian-win-node
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Commission -NodeId brian-win-node
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Uninstall -NodeId brian-win-node
```

Logs are written under `%ProgramData%\Lensically\LocalExecutionNode\logs` with long secret-like values redacted.
