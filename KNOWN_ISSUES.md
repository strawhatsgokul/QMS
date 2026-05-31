# Known Issues & Workarounds

The QMS Dashboard system works reliably in production, but a few architectural workarounds exist to handle external dependency constraints. These are stable, tested mitigations — not bugs.

| Issue | Workaround | Details |
|-------|------------|---------|
| Veyon CLI requires Admin Privileges | Agent writes directly to Registry | The `bootstrap-veyon.ts` script writes Veyon configuration directly to `HKLM\SOFTWARE\Veyon` using the Agent's SYSTEM privileges, bypassing the need for interactive admin CLI prompts. |
| ActivityWatch Screenshot 503 Error | 1.5s Delay | Veyon's VNC framebuffer takes a moment to initialize. We add a 1500ms delay before fetching screenshots to prevent race conditions. |
| ESLint v9 Incompatibility | `lint:web` excluded | `next lint` is currently incompatible with the root ESLint config. We rely on `npm run typecheck` for strict validation instead. |
| Server cannot control "Localhost" | Install Agent on Server | The Dashboard uses Veyon direct IP checks. To manage the server machine itself, install the `qms-agent.exe` on the server. The agent will report its status, allowing full control. |
| `pkg` hangs on local build | Use GitHub Actions Artifact | Network restrictions sometimes cause `pkg` to stall. Download the pre-built `qms-agent.exe` from the GitHub Actions Artifacts page instead. |
