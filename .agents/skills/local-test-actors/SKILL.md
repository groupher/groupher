---
name: local-test-actors
description: Create local Groupher test accounts and owner-bound Article fixtures, configure resource-scoped lord, Admin or co-author permissions, and isolated browser sessions that open Dash without login UI. Local development only.
---

# Local Test Actors

Use the Dev Hub fixture commands. Code rejects deployment environments, remote Hub/DB targets, unregistered identities and cross-community Dash access. Never substitute direct SQL, a real account, remote URLs, an alternate port or a production seed workflow.

Use [dev-hub](../dev-hub/SKILL.md) for runtime prerequisites. Read [the command runbook](../../../docs/auth/local-test-actors.md) for exact options and failure boundaries. Use [local-test-community](../local-test-community/SKILL.md) when a new community is needed.

## Workflow

- Select a unique lowercase `--run` for this task. Use named aliases for repeatable roles; create several random accounts with `actors create --run <run> --count 3`. Same run/alias reuses the account. Different runs do not isolate shared content in the development database.
- `actors list --run <run>` reports public logins and actual Community memberships. Keep run/alias-to-browser mapping in the task report.
- Community permissions always name `--community`. `--role lord` is an explicit local bootstrap for a registered synthetic account; it refuses promotion of an ordinary Admin. Ordinary permissions require `--by <registered-manager-alias>` and a complete comma-separated permission set. Missing dependencies are errors, not implicit grants.
- Create a real unpublished Post fixture with `articles create --run <run> --as <owner-alias> --community <slug> --thread post --key <key>`. The selected synthetic account must already be a Community Admin. The command signs in temporarily and calls the normal Dash Content Publisher; Phoenix verifies the actual Article owner and initial Snapshot command provenance. Never insert Article rows, assign author IDs, construct BodyBag, or select a real account as a substitute.
- Use the returned `articleId` for Article grants; `workingCopyId` is a different UUID. Same run/owner/community/thread/key reuses the verified Article and returns its current WorkingCopy revision. Different title/Markdown under the same key is a conflict; use another key for another fixture. Omitted key is `primary`; `--title` and `--markdown` are optional. Reuse the same arguments after a failed response so the stored commandId can recover normally.
- Article grants name `--article <uuid>` and the registered Article manager with `--by`. Community lord is not Article owner or co-author. Use an Article actually owned by the selected test account; do not change author IDs to make a scenario pass.
- Ordinary Admin/co-author preparation invokes real invite/accept/update Commands. Add `--pending` to leave an invitation for UI acceptance. Existing pending proposals must match; do not silently replace them.
- `actors open --run <run> --as <alias> --community <slug>` signs in through development Auth and opens Dash in a dedicated persistent Chrome profile. It verifies viewer and membership and saves a screenshot in `.playwright/`. No manual login, console command, token copying or localStorage injection is needed.
- For ordinary session debugging use the same command with `--app community`; it opens the public Community without adding management privileges. Default is Dash. Multiple identities must use their own profiles, not tabs sharing a profile.
- For optional cleanup, first run `actors clean --run <run>` (read-only scope), then `actors clean --run <run> --apply`. It cancels pending requests, leaves co-author memberships, archives only run-created communities, removes synthetic Admin/lord/Global grants, and removes stopped browser profiles. Article fixture references are included in the cleanup report. Accounts/content/audit remain under existing deletion contracts; confirmed Article references stay available as retained records. Blocked or partial cleanup is not success; inspect its report and retry after resolving the stated domain issue. Never force deletion or disable database triggers.
- Use `actors close --run <run>` when finished if the user does not need the sessions. It revokes all sessions for those synthetic accounts, closes owned browsers and seals the run. Retain account/content history; physical deletion is a separate operation. Use a new run to continue after closure.

Report actual account aliases/logins, Community refs/slugs, grants and opened pages. Never report cookies, session refs, private Hub state, signing keys or bearer tokens. A successful open verifies the selected viewer and page; individual actions still require their own Passport/Gate acceptance.
