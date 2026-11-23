---
name: local-test-community
description: Create a local Groupher development community owned by a synthetic test account, initialize its real lord membership, and open its Dash without login UI. Use with local-test-actors for multi-account scenarios.
---

# Local Test Community

Use this only for local development fixtures. Production releases omit the fixture implementation and route; the command also verifies actual local database identity. Do not use production seed, raw inserts, reserved production namespaces or normal signup UI as substitutes.

Use [dev-hub](../dev-hub/SKILL.md) for service readiness and [local-test-actors](../local-test-actors/SKILL.md) for identities, grants and browser profiles. Read [the command runbook](../../../docs/auth/local-test-actors.md).

## Create and open

```bash
pnpm devhub actors create --run <run> --alias owner
pnpm devhub communities create --run <run> --owner owner --slug <unique-slug>
pnpm devhub actors open --run <run> --as owner --community <unique-slug>
```

Community creation uses the existing receipt Command, which creates the core, defaults, Lifecycle and initial lord membership. It does not insert a community row alone. An omitted slug is randomized; specify it for repeatable setup. Reusing an explicit slug succeeds only if the run's owner created and recorded that community; unrelated collisions are rejected.

For an existing local community, do not recreate or claim it. Explicitly bootstrap a dedicated synthetic lord with `actors grant --run <run> --as <alias> --community <slug> --role lord`, then prepare ordinary Admins through that lord's normal invitation commands. Do not promote `local-debug` or another existing account.

The tool adds no sample content by default. When an Article is needed, use `articles create --run <run> --as owner --community <unique-slug> --thread post --key primary` from local-test-actors; it returns a real owner-bound Article UUID through the normal Publisher/Command path. Verify a newly created community's real Dash page, then use `/home/xx` when a test needs existing content. Creating a fixture community does not validate application/reviewer onboarding; use that product workflow when it is the feature under test.

Report the run, owner login, resulting community ref/slug and opened Dash URL. Closing a run revokes sessions but preserves community/content/history; never delete shared resources by a slug prefix.

Optional cleanup uses `actors clean --run <run>` to preview, then `--apply` to archive only recorded run-owned communities and remove synthetic grants/profiles. Shared communities stay intact; accounts and content history remain. Foreign members or ownership changes block cleanup. Never bypass Lifecycle or physical-account-deletion guards.
