# Local Auth Debug

Use [Dev Hub guide](../../../../docs/architecture/dev-hub-local-environment.md) for read-only status, logs and runtime recovery. Use [seed](../../seed/SKILL.md) to prepare a synthetic actor. Use the managed browser command for an actor session, or the real login page when testing login itself. The fixed local-debug/local-passport-admin logins and their flags have been removed.

Read [the local identity runbook](../../../../docs/auth/local-test-actors.md). Diagnose by boundary:

- Missing fixture route: verify development entrypoint and restart the owning service through Hub. Production and Worker routes must remain absent.
- `local_test_environment_required` / `local_test_database_required`: fix the actual local runtime or database identity; never add an override.
- `local_test_community_admin_required`: check the named actor and community membership. Do not automatically grant lord.
- Browser login works but Dash SSR fails: inspect Dash GraphQL/service-auth configuration separately. A user session does not replace the Dash service credential.
- Cookie or refresh problems: verify the canonical local HTTPS host, normal HttpOnly cookies and selected profile. Do not copy cookies into code or print tokens/session refs.

Managed services receive environment from Hub's private state, not application dotenv files. Dev Hub prepares and reuses the service identity when services start. Restart only affected services after a configuration change. Keep diagnostics read-only until repair or login is within the user's scope.
