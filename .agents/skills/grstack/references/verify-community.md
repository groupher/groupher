# Verify Community

Use the [feature map](../../../../docs/infra/tooling/acceptance/README.md) to select the behavior to verify. The map records concrete user journeys and their verification status, not a claim that every Community feature is covered.

## Prepare and check

- Follow [dev-hub](../../dev-hub/SKILL.md) for status, doctor, canonical URLs and any required service operation. Preserve the existing service set. A running process or healthy proxy alone does not prove the app is usable.
- Follow [seed](../../seed/SKILL.md) for synthetic actors, owner-bound Articles and separate browser profiles. Data-dependent Community journeys use `/home/xx`. Do not edit existing users' content.
- Record the branch, commit, initial services and owned resources in `.playwright/<run>/cleanup.md` before creating fixtures. Use a fresh run name for each completed acceptance; retries of the same unfinished setup retain the same run and inputs.
- Check the selected actor and Community through the fixture tool before driving the page. If setup returns HTML, inspect the owning service logs; do not treat it as an auth failure or bypass the managed runtime.

## Drive and prove

Read only the selected journey. Use `actors open` and `actors ui` with accessible roles/names observed in its snapshot. Keep fixture setup separate from proof: fixture creation is not evidence that the product's create/publish UI works.

For each step, record the action, resulting URL and expected visible state. Save bounded snapshots and screenshots under `.playwright/<run>/`. Never include cookies, private state or credentials. A screenshot alone does not prove persistence, identity, or a business write. If a required control cannot be driven through the current harness, report the missing coverage rather than substitute an internal setter.

Report each journey as passed, failed or blocked. Include the actual evidence path and uncovered behavior. A failed or blocked journey stays that way until rerun; do not weaken its assertions to get a pass.

## Cleanup and maintenance

Follow [test-cleanup](test-cleanup.md): preview and apply cleanup for this run, revoke/close owned sessions, record retained content and verify evidence survives. Keep shared communities and unrelated processes intact.

When a route, control or behavior changes, update its journey from the real app and rerun it. Record the tested commit and result in the run evidence; a source-only edit to this map is not a successful acceptance run.
