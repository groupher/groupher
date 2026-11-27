---
name: dev-hub
description: Manage and diagnose Groupher local development services through Dev Hub and Portless. Use when starting, stopping, or restarting application servers, diagnosing local service, browser login, session or HTTPS failures, or preparing browser acceptance. Excludes production operations and checks that do not need a running service.
---

# Groupher Dev Hub

Keep local application processes under Dev Hub and validate browser flows through their canonical Portless URLs. Loading this skill does not authorize a service restart, system initialization, login, or business mutation beyond the user's task. For read-only diagnosis, use status, logs, and doctor without starting or changing anything.

## Establish the Runtime

Run commands from the current repository root. Use the repository-pinned CLI; do not use a global Portless binary or download another version on demand.

```bash
pnpm devhub status
pnpm devhub logs <service-id>
pnpm devhub doctor
```

Use returned service IDs and URLs. Do not reconstruct names or ports from memory. The CLI checks `/api/identity` against the current worktree before controlling Hub services.

On a revision providing managed secondary environments, use the registered checkout’s own `pnpm devhub up`, allocated product URLs and database targets. See `docs/architecture/dev-hub-multi-worktree.md` on that revision. `pnpm devhub doctor` reports registration, verified service snapshots and database migration status; it does not by itself prove browser traffic reached the intended backend. Creating or switching worktrees and handing over a shared runtime still require the authorization described in AGENTS.md.

The workspace uses `verifyDepsBeforeRun: warn`: dependency drift is reported without an implicit install before scripts. If startup or a missing CLI dependency requires preparing a linked checkout, follow [GrStack worktree dependency preparation](../grstack/SKILL.md#prepare-worktree-dependencies) before installing. Treat missing dependencies as a separate installation step within the task's authorization; do not make status/log commands download the workspace or suppress missing CLI dependencies by starting a substitute server.

Editable local configuration is managed in the service configuration drawer and stored under `local/dev-hub/config/<serviceId>.env`. Use that entry for declared DB/cache settings rather than changing `services.ts`; saving applies only on the next service start. The drawer shows next-start sources and redacts secrets, not a live process snapshot. Move needed allowlisted external credentials from legacy app dotenv files into this entry; those files are no longer runtime sources for Hub. See [central local configuration](../../../docs/architecture/dev-hub-local-config.md).

Service credentials are prepared automatically by Dev Hub and kept in its private state. Follow [local Auth debugging](references/local-auth.md) for browser user login, which is separate from service identity.

- Hub is unavailable: when runtime startup is in scope, use the target checkout’s supported startup command. Use `pnpm devhub up` for a registered secondary. For the legacy primary use `make dev` or open the installed Dev Hub app. Use `make dev.dev` only when developing Hub itself.
- An existing Hub returns HTML instead of the current API: it needs a normal restart. Check the impact on its managed services before restarting; stop it through its own terminal or app. Do not launch a competing Hub or bypass identity validation with raw process-control requests.
- Hub belongs to another worktree, or a port/domain is owned by another process: report the conflict. Do not change ports, take over aliases, or kill an unverified process.

Keep the current branch/worktree as the default under [AGENTS.md](../../../AGENTS.md#branch-and-worktree-ownership). Only for a runtime switch explicitly authorized by the user, use [dev-hub-worktree](references/shared-runtime-handoff.md), which records the original service set and restores it after acceptance. Use [pr-integration](../grstack/references/pr-integration.md) to prepare a temporary PR checkout and its caches before switching.

## Operate Through Hub

```bash
pnpm devhub start <service-id>
pnpm devhub restart <service-id>
pnpm devhub stop <service-id>
pnpm devhub url <service-id>
```

`start` preserves the service's default dependency chain. Use explicit `chain`, `related`, or `self` modes only when the intended debugging scope calls for them; do not switch to `self` to bypass a failed dependency or startup check. Preserve healthy services and restart only what the task needs.

`url` asks Hub to prepare Portless again before returning the canonical URL. Wait for the target service to be running and inspect its logs if readiness fails. Do not substitute a raw listener URL when a canonical URL is unavailable.

Root `dev:*` scripts and public Make development targets are Hub aliases. Service definitions call their paired internal `:managed` scripts or `.managed` Make targets; those are for Dev Hub to invoke. Do not run managed targets or application package `dev` scripts directly. Do not invoke Vite, Phoenix, Uvicorn, Workers, or another server launcher to create an alternative instance, and do not background an ad hoc server with `&`, `nohup`, or another launcher.

## Portless Initialization and Recovery

Hub shares one preparation path across Web startup, the development API, and desktop cold startup. Start/restart and CLI URL lookup recheck the environment. It validates the HTTPS proxy, CA trust, and static aliases generated from service definitions.

- No OS startup service is required. `Installed: no` alone is not a failure.
- On macOS, cold startup explicitly uses `--unprivileged --https --port 443`. Ordinary preparation does not run CA trust or hosts writes. Linux low-port permissions depend on machine configuration; do not change system policy automatically.
- Initial CA trust and hosts initialization belong to the explicit `pnpm portless:setup` command. Run it when initialization or repair is authorized. If it requests a password, explain the actual requirement and hand that terminal step to the user; do not handle or store their password.
- Existing initialization normally persists. CA removal or additional hostnames may require setup again; do not promise that authorization can never recur.
- A healthy existing proxy is reused. CLI package version and a running daemon's version are separate facts; upgrading the package does not prove the daemon has restarted.
- `pnpm portless:sync` shares normal preparation. Do not replace it with a hand-maintained alias list or `--force` takeover.

If proxy, TLS, trust, aliases, or service dependencies fail, report the exact boundary and stop dependent browser acceptance. Continue independent checks. Do not change ports, disable TLS, ignore browser certificate errors, rewrite hosts or auth/proxy settings, or add a bypass switch to make the task appear successful.

When repairing that boundary is within the authorized task, fix the owning source or configuration and rerun the Hub preparation path. A failure does not authorize a substitute server or broaden the task.

## Validate and Report

Verify the actual canonical product page and requested interaction. Login, cookies, callbacks, navigation, and writes must use the relevant product entrypoint. Internal loopback requests remain valid for Hub APIs, service communication, and health diagnosis; they do not prove a browser flow works. A healthy proxy or GraphQL `__typename` response also does not establish end-to-end business correctness.

Type-checks, builds, and ordinary unit tests may run directly. Existing named E2E or parity runners may own isolated test listeners; keep them within their documented purpose instead of using them as a replacement development environment. For data-dependent browser checks, use the `/home/xx` community and place screenshots under `.playwright/`.

Report separately: changes on disk, what the currently running Hub/daemon has loaded, checks performed, and remaining blockers. Redact credentials and cookies from diagnostics. Do not claim acceptance if an environment prerequisite prevented it.

## Sources of Truth

Read only the material needed for the current issue:

- [Local development runbook](../../../docs/infra/local-development.md): runtime topology, product routes, and named parity workflows.
- [Portless integration](../../../docs/infra/portless.md): preparation, initialization, aliases, and worktree limits.
- [Dev Hub README](../../../local/dev-hub/README.md): Web/desktop entrypoints, process ownership, and log locations.

When implementation details are needed, use CodeGraph for `local/dev-hub/src/server/services.ts` (service definitions), `portless.ts` (shared preparation), and `cli.ts` (CLI/API behavior). Do not duplicate their port table or executable logic in this skill.
