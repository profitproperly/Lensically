# Lensically Local Execution Node

This package installs a Windows-only outbound polling node for Lensically validation and engineering jobs.

The node never opens an inbound port. A boot-time Windows Scheduled Task runs the immutable bootstrap as `SYSTEM`, polls Lensically over HTTPS, verifies signed bounded jobs, launches the active worker package, reports heartbeats and raw stage evidence, and can install a candidate worker into the inactive slot after local commissioning checks.

One-time elevated installation after Main creates a short-lived single-use enrollment token:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Install -NodeId brian-win-node -LensicallyOrigin https://api.lensically.com -EnrollmentToken <single-use-token>
```

The installer generates a per-device credential locally and enrolls it with the single-use token. Main stores only the credential hash. Future heartbeat, poll, job-verification, and result requests authenticate the exact node with that per-node credential; job payloads are still separately verified with server-signed exact-SHA envelopes. Successful validation results return `local-stage-evidence-v1`; Main verifies the evidence and creates the canonical server-signed `local-validation-receipt-v1`.

No device secret is committed to Git, and no ordinary future worker update requires editing Cloudflare secrets or touching the PC. The bootstrap root of trust remains `service.mjs`; remotely replaceable worker logic lives only in the active/previous worker slots.

Validation jobs do not run in the owner working tree. The worker fetches the authorized repository into a node-controlled bare cache under `%ProgramData%\Lensically\LocalExecutionNode\source`, verifies the requested exact commit exists, creates a per-job detached worktree for that SHA, runs dependency installation and validation stages inside that isolated worktree, and removes the worktree unless diagnostics explicitly request bounded retention.

The install root ACL disables broad inherited access and grants control to `SYSTEM` and local Administrators. `config.json` is protected the same way so ordinary users cannot read the device credential. The enrollment token is removed from `config.json` immediately after successful enrollment.

Repair, commissioning, and uninstall:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Repair -NodeId brian-win-node
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Commission -NodeId brian-win-node
powershell -ExecutionPolicy Bypass -File .\scripts\install-local-node.ps1 -Mode Uninstall -NodeId brian-win-node
```

Logs are written under `%ProgramData%\Lensically\LocalExecutionNode\logs` with long secret-like values redacted.
