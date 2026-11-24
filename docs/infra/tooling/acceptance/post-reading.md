# Read a published Post

Status: passed on 2026-11-24 in the current working copy, run `verify-fixture-auth-20261124`. The managed local runtime passed fixture publication, list discovery, preview opening, direct detail and reload assertions. Evidence is retained under `.playwright/verify-fixture-auth-20261124/`: `acceptance.json`, screenshots for all four steps, test logs and `cleanup.md`. This is authenticated-owner read acceptance, not anonymous access or publishing-UI acceptance.

## Outcome and preconditions

A reader finds a uniquely titled published Post in the existing `home` Community, opens its detail and sees the same title and body after leaving and reopening it. The concrete Posts route is `/home/post`; `/home/xx` in the general testing convention refers to this Community's routes, not a literal Post list URL. This checks the real list/detail route and read projection; it does not test the publishing UI or anonymous access.

Use an isolated synthetic owner account and an Article created for this run. Do not adopt a real account or edit an existing Post. The fixture CLI supports Post only; the same recipe is not evidence for Docs or Changelogs.

## Prepare

From the repository root, choose a fresh run and unique markers. Example shell variables below are reused throughout this journey:

```bash
verify_run="verify-post-$(date -u +%Y%m%d%H%M%S)"
verify_title="Post acceptance ${verify_run}"
verify_body="Body acceptance ${verify_run}"
pnpm devhub actors create --run "$verify_run" --alias owner
pnpm devhub actors grant --run "$verify_run" --as owner --community home --role lord
pnpm devhub articles create --run "$verify_run" --as owner --community home --thread post --key reading --publish --title "$verify_title" --markdown "$verify_body"
pnpm devhub actors open --run "$verify_run" --as owner --community home --app community --headless
```

Record returned Article and WorkingCopy identities separately. Creation must confirm publication through the normal Publisher path. The synthetic lord grant prepares the fixture; it does not prove ordinary-reader authorization.

## Drive through the user interface

```bash
pnpm devhub actors ui --run "$verify_run" --as owner --community home --app community --op navigate --path /home/post
pnpm devhub actors ui --run "$verify_run" --as owner --community home --app community --op snapshot
pnpm devhub actors ui --run "$verify_run" --as owner --community home --app community --op assert-text --text "$verify_title"
```

Find the title link in the returned accessible snapshot. Click its exact observed accessible name with `--op click --role link --name '<observed name>'`; do not guess its route from an Article UUID. Record the resulting detail URL, title and body:

```bash
pnpm devhub actors ui --run "$verify_run" --as owner --community home --app community --op assert-text --text "$verify_title"
pnpm devhub actors ui --run "$verify_run" --as owner --community home --app community --op assert-text --text "$verify_body"
```

Inspect the snapshot for a successful Article preview and absence of the route error boundary. The list remains mounted behind a preview, so title/body text anywhere on the page alone is insufficient. A browser script can assert the real rendered body with `getByTestId('article-body')`; its text must equal the fixture body marker, with no `Community page could not be loaded` heading.

Navigate back to `/home/post`, then navigate to the exact detail path observed above and repeat both assertions. Reload the direct detail and verify its actual body again. Save the action results and snapshots. This proves reopening a server-prepared Post, not persistence of an editor change. A missing title, body, usable link, or successful reopened detail is a failed journey; an unavailable runtime/fixture is blocked.

## Cleanup and gotchas

Preview `pnpm devhub actors clean --run "$verify_run"`, then apply with `--apply` and inspect the report. Close the run with `actors close` if cleanup did not already close it. Retain account, Article and audit history according to the existing fixture policy; remove synthetic grants and owned sessions. Record exact retained IDs and confirm evidence files remain.

- A fixture retry uses identical creation arguments and key. Changed inputs conflict; use another key for another Article.
- A published fixture can remain in shared Community data after cleanup. Its unique marker must make it recognizable in later runs.
- Use the accessible title link's observed detail path. Preview navigation masks the drawer route with the same public detail URL; verify both the clicked preview and direct navigation.
- This run uses an authenticated owner. Test anonymous visibility or restricted readers as separate journeys with separate profiles and explicit expectations.
