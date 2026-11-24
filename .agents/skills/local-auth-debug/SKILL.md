---
name: local-auth-debug
description: Diagnose local Groupher Auth, browser session, cookie and Dash service-identity failures. Use local-test-actors for creating or opening test identities; excludes production auth.
---

# Local Auth Debug

Use [dev-hub](../dev-hub/SKILL.md) for read-only status, logs and runtime recovery. Use [local-test-actors](../local-test-actors/SKILL.md) to create or sign in a synthetic identity when that state change is authorized. The fixed local-debug/local-passport-admin logins and their flags have been removed.

Read [the local identity runbook](../../../docs/auth/local-test-actors.md). Diagnose by boundary:

- Missing fixture route: verify development entrypoint and restart the owning service through Hub. Production and Worker routes must remain absent.
- `local_test_environment_required` / `local_test_database_required`: fix the actual local runtime or database identity; never add an override.
- `local_test_community_admin_required`: check the named actor and community membership. Do not automatically grant lord.
- Browser login works but Dash SSR fails: inspect Dash GraphQL/service-auth configuration separately. A user session does not replace the Dash service credential.
- Cookie or refresh problems: verify the canonical local HTTPS host, normal HttpOnly cookies and selected profile. Do not copy cookies into code or print tokens/session refs.

Managed services receive environment from Hub's private state, not application dotenv files. `pnpm devhub setup-auth` runs the existing idempotent preparation; it does not rotate identities. Restart only affected services after a configuration change. Keep diagnostics read-only until repair or login is within the user's scope.
