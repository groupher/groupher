# Local test actors and communities

The development-only Dev Hub commands create synthetic accounts, real Community and Article
permissions, and isolated browser profiles. `actors open` signs in through Auth and navigates directly
to Dash; no OAuth page, login button or console request is required.

## Local-only boundary

- Phoenix compiles `backend/api/dev/` only in `MIX_ENV=dev`. Its fixture route is compiled only in
  development; the release contains neither the implementation nor the route.
- Production Node Auth builds `src/server.ts`; the Worker has its own entrypoint. Neither imports
  `dev-server.ts`, the local identity handler or development cookie helpers.
- Hub supplies a purpose-separated private key only to Auth and Phoenix. CLI verifies the current
  worktree's loopback Hub before reading private state. Management transport accepts loopback
  requests and the private key; browser login retains Origin and CSRF checks.
- Every operation checks the environment and actual Repo configuration/database identity. Only the
  local `groupher_server_dev` database on the local standard PostgreSQL port is admitted. Production,
  staging, preview, CI and remote database targets are rejected. There is no target or force option.
- Accounts are registered through Accounts and identified by tool-owned synthetic provider bindings
  containing run/alias provenance. Arbitrary existing accounts cannot be selected or promoted.
- Browser cookies are ordinary HttpOnly Auth/Phoenix cookies. Sessions expire after at most eight
  hours and can be revoked. Passport, Gate, Lifecycle and normal resource revisions remain in force.

The fixed `local-debug`, `local-passport-admin`, their old enable flags, and the special lord script
have been retired. Existing database rows are preserved; the new tool does not adopt them. Isolated
E2E retains its own provider-login helper, independent of daily development fixtures.

## Prepare the runtime

Use `make dev` and the existing Dev Hub entrypoints. Required services are started through Hub:

```bash
pnpm devhub start dash
pnpm devhub start community
```

After updating Hub's environment resolver, restart the existing Hub normally, then start the needed
services so the new private key is injected. Do not launch application servers directly or edit app
`.env` files. A user session remains separate from Dash's service identity.

## Create accounts and a community

Use a distinct run per task. Names use lowercase letters, digits and hyphens, start with a letter and
have at most 40 characters.

```bash
pnpm devhub actors create --run coauthor-demo --alias owner
pnpm devhub actors create --run coauthor-demo --alias editor
pnpm devhub actors create --run coauthor-demo --count 3
pnpm devhub actors list --run coauthor-demo
pnpm devhub communities create --run coauthor-demo --owner owner --slug coauthor-demo
pnpm devhub actors open --run coauthor-demo --as owner --community coauthor-demo
```

Login names have random suffixes. An explicit run/alias is reused on retry; anonymous single creates
choose a random alias. `--count` creates numbered aliases, optionally prefixed by `--alias`. Community
creation uses the existing receipt Command, defaults, Lifecycle and initial lord setup. Omit `--slug`
for a random slug. An explicit slug is reusable only when that run/owner created and recorded it;
unrelated existing resources are never claimed. Communities start without sample content.

## Create an owner-bound Article fixture

```bash
pnpm devhub articles create --run coauthor-demo --as owner \
  --community coauthor-demo --thread post --key primary
```

By default, this creates a real unpublished Post and its default WorkingCopy through the existing Dash
Content Publisher and Phoenix `CreateArticle` Command. Add `--publish` to create and publish the Post
atomically through the Content Publisher's `article.create_and_publish` action and Phoenix Command.
The tool uses a fresh temporary browser session and attempts normal logout before closing it; existing
actor browser profiles are not changed. The owner must be a registered active run identity and already
an Admin of the explicit community. No management permissions are added by the create command. Only
`--thread post` is supported in this first version.

The response contains `articleId`, `workingCopyId`, `revision`, `ownerLogin`, `community`, `communityRef`,
`thread`, `key`, `publish` and `snapshotId` (null for a draft). A published Article is visible in Posts.
Use **articleId**, not the WorkingCopy UUID, with Article permission commands. Phoenix checks the
canonical Author user ID, Binding, default WorkingCopy and the initial creation Snapshot's causation
commandId before recording a successful fixture. Published fixtures also verify the publish event,
Snapshot provenance and current public Snapshot.

The fixture identity is run + owner alias + immutable Community ref + thread + key. Omitted key is
`primary`; use distinct keys for multiple Articles. `--title` and `--markdown` optionally customize the
initial content. The publish mode is part of the intent digest, so changing publish mode, title or
Markdown under an existing key is rejected. Preparing an intent persists its commandId and input digest
before calling Publisher. Retry with the same arguments recovers that command; once confirmed it reads
the current canonical WorkingCopy without rewriting edited content. A missing or unrelated Article is
not silently adopted or recreated.

`actors clean` reports `article_fixtures_retained`, including confirmed IDs and pending intents.
Cleanup retains Article content and history under the existing policy; it can archive the run-owned
Community and remove synthetic grants without deleting a shared Article.

The focused local skill acceptance creates and reuses an Article, checks owner/UUIDs and input
conflicts, then validates the cleanup report. It does not exercise co-author invitation or editing:

```bash
pnpm --filter @groupher/local-dev-hub test:local-articles --clean
```

Non-secret evidence is written to `.playwright/local-test-articles-acceptance.json`.

## Resource-scoped permissions

Accounts are global identities. Community and Article permissions always identify their scope.

```bash
# Existing local community: explicit trusted initialization of a synthetic lord.
pnpm devhub actors grant --run coauthor-demo --as owner --community home --role lord

# Ordinary Admin: real invite + accept; complete permission set required.
pnpm devhub actors grant --run coauthor-demo --as editor --community home \
  --by owner --permissions dashboard.theme.update

# Article co-author: use an actual Article UUID owned by the named manager.
pnpm devhub actors grant --run coauthor-demo --as editor --article <article-uuid> \
  --by owner --permissions article.read_draft,article.update

# Global ordinary permissions (never root).
pnpm devhub actors grant --run coauthor-demo --as editor --scope global \
  --permissions review.platform.read
```

Permissions come from the generated Catalog. Unknown keys, wrong scope, non-grantable actions and
missing dependencies fail. Ordinary Community/Article setup uses domain invite/accept/update Commands,
including events and notices. `--pending` leaves a new invite for interactive acceptance. An existing
pending proposal must match. Existing memberships use revisioned permission replacement; Global
ordinary grants are additive. Lord initialization refuses to promote an ordinary Admin.

Community lord does not imply Article ownership or editing. Default Dash open verifies membership
in the selected community and never adds permissions. Individual pages/actions still use their real
requirements. To debug an ordinary browser account without giving it Admin permissions:

```bash
pnpm devhub actors open --run coauthor-demo --as actor-1 --community home --app community
```

## Browsers and session lifecycle

Each run/alias has a persistent, independent Chrome profile under the user data directory
`Groupher/DevHub/<worktree-id>/browsers/`. Install Chrome and trust local HTTPS through the normal
Portless setup. Browser workers have no HTTP listener; they live until their window or run closes.
Do not use ordinary tabs of one profile for separate identities. Reopening reuses the profile and
reauthenticates the selected synthetic account. The command verifies the current viewer and saves a
screenshot under `.playwright/`. `--headless` is available for a local acceptance run.

```bash
pnpm devhub actors close --run coauthor-demo
```

### Bounded UI actions

`actors ui` operates only an already-open profile for the named run and alias. Each call first asks
Phoenix to recheck that actor's active identity and access to the selected Community. Dash actions
require the normal Community Admin admission; Community actions require the normal read scope. Use
the corresponding app profile for each actor.

```bash
pnpm devhub actors ui --run coauthor-demo --as owner --community coauthor-demo \
  --app dash --op snapshot
pnpm devhub actors ui --run coauthor-demo --as owner --community coauthor-demo \
  --app dash --op navigate --path /coauthor-demo/docs
pnpm devhub actors ui --run coauthor-demo --as owner --community coauthor-demo \
  --app dash --op click --role button --name Save
pnpm devhub actors ui --run coauthor-demo --as owner --community coauthor-demo \
  --app dash --op fill --role textbox --name Title --value 'Updated title'
pnpm devhub actors ui --run coauthor-demo --as owner --community coauthor-demo \
  --app dash --op press --key Enter
pnpm devhub actors ui --run coauthor-demo --as owner --community coauthor-demo \
  --app dash --op assert-text --text 'Saved'
```

`snapshot` returns at most 4,000 characters of visible page text and 4,000 characters of accessible
control summaries; it omits form values. `click` and `fill` require an exact accessible role/name and
exactly one matching control. Link clicks validate the href before navigation, then every operation
checks that the resulting page stays on the selected app origin and either the selected Community
route or `/home`. `navigate` accepts a path only; absolute URLs, query/hash values, other Communities,
and traversal segments are rejected. `press` accepts only Enter, Tab, Escape, arrow keys, Backspace,
Delete, Home and End. The interface has no arbitrary selector, script evaluation, cookie/storage,
header or network inspection. It does not expose an HTTP listener.

Close revokes all sessions for that run's accounts, closes their browsers, removes their profiles and
seals the run. Existing cookies then fail normal session validation. Accounts, permissions, communities,
requests and history are retained; physical account deletion is not part of close. A new run is required after closure. Runs do
not isolate a shared Article or database; use separate resources when tests must not interfere.

## Optional cleanup

`close` seals the run, revokes sessions and removes its browser profiles. To remove browser profiles without changing account state, use `pnpm devhub actors browsers-clean --run <run>`. `clean` first reports its scope without changing data:

```bash
pnpm devhub actors clean --run coauthor-demo
pnpm devhub actors clean --run coauthor-demo --apply
```

Apply closes sessions, cancels pending Admin/co-author requests involving run identities through domain
Commands, leaves co-author memberships, archives only communities recorded as created by the run,
and removes those synthetic accounts' Admin/lord and Global grants. Shared communities remain intact.
A separate checked cleanup session serializes the run while each domain Command keeps its own
transaction and lock order. Reported blockers prevent changes; partial failures return a nonzero CLI
exit and preserve the report so cleanup can be retried. Browser profiles are deleted only after all
cleanup steps succeed and the owned browser workers have stopped; symlinked run directories are refused.

The account-deletion database guard is preserved. Accounts, content, notices and audit/Receipt history
remain; owned communities are archived through Lifecycle, not physically deleted. An unexpected linked
OAuth identity, system-root grant, changed community owner or foreign member in an owned community
blocks cleanup. There is no force mode or blanket deletion by name prefix.

The local acceptance runner has an optional cleanup step:

```bash
pnpm --filter @groupher/local-dev-hub test:local-actors --clean
```

## Diagnose failures

| Result                               | Action                                                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Fixture route 404                    | Confirm the development runtime and restart Phoenix through Hub. Production must stay 404.                                                                                                                            |
| Local access denied                  | Restart Hub and affected services to receive matching private configuration. Never print the key.                                                                                                                     |
| Environment/database required        | Repair the real local target. No override is supported.                                                                                                                                                               |
| Actor unavailable                    | Check run/alias, registration and whether the run is closed.                                                                                                                                                          |
| Community Admin required             | Grant the intended scoped membership explicitly, or use Community mode for an ordinary account.                                                                                                                       |
| Permission dependency missing        | Supply the complete intended set from Catalog; no automatic elevation.                                                                                                                                                |
| Login succeeds, Dash fails           | Check the viewer, Dash service identity, GraphQL path and actual resource admission separately.                                                                                                                       |
| Viewer query HTTP/JSON/GraphQL error | Check the selected app's logs before diagnosing account identity. A 204 login does not prove `/api/graphql` is healthy; after dependency changes, restart an app through Hub if logs show stale missing module paths. |

For existing content acceptance use `/home/xx`. For new-community acceptance use the community just
created by the command. Keep screenshots in `.playwright/`. Never put cookies, session refs, private
state, keys or bearer tokens in reports.

## Local acceptance

Run `pnpm --filter @groupher/local-dev-hub test:local-actors` against the managed local runtime.
It creates an isolated run/community, opens an authenticated Dash browser, verifies scoped permissions
and negative cases, then closes the run and checks that the old browser Cookie is rejected. It uses
Chrome's normal trusted HTTPS; certificate validation is never disabled. Non-secret evidence is
written to `.playwright/local-test-actors-acceptance.json`.

On 2026-11-23 the full local acceptance passed. Separate profiles also opened lord and ordinary Admin
Dash pages, and an ordinary account opened Community without management privileges. Focused backend
tests covered actual co-author requests/membership/events, missing permission dependencies, lord setup,
DB/environment admission and normal browser-session revocation. Auth and Hub unit tests, production
Auth module-graph checks, type-checks and documentation gates passed. The default shared test database
was blocked by an existing Docs cutover migration, so backend checks used a new isolated test database;
the full backend suite was not run.

Acceptance exposed an existing ordinary-Cookie authentication gap: JWT validity was checked without
checking the persisted Session. Ordinary and delegated browser credentials now share the existing
active-Session check, so closing a run immediately revokes old Cookies through normal authentication.
