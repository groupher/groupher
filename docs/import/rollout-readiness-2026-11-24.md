# Import canonical configuration rollout — 2026-11-24

> 状态：current

## Prepared resources and code

- Canonical R2 bucket `groupher-import` was created in the Groupher account.
- The Import Worker now has the new `IMPORT_PREVIEW_SECRET` binding.
- Auth has a prepared `SERVICE_AUTH_CLIENTS_JSON_IMPORT` secret containing only hashed credential registrations for the coordinated Import/Dash cutover. The new reader evaluates this explicit registry before the base registry, so the named Dash registration can be rotated without reconstructing or replacing unrelated client registrations.
- Canonical Import identity uses `service:import`, resource `https://api.groupher.com/import`, audience `phoenix:import-api` and scope `import:write`.
- Dash's Import proxy uses resource `https://import.groupher.com/internal`, audience `import:internal-api` and scope `docs:import:proxy`. The coordinated Dash registration also preserves its Content Publisher Article/Comment/history grants.
- No old-data conversion, legacy audience alias or preview-object copying is part of this rollout.

## Observed production state before cutover

The active Import and Auth versions were still dated 2026-10-25. Import's live metadata referenced `groupher-content-import`, its old audience and `/content-import` Phoenix resource. Auth's live resource map likewise contained the old Import identities. Creating the new resources does not establish that the new code is serving production traffic.

The Fly token replacement passed authentication and image build. The next failure occurred when Postgrex 0.23 received the string `"require"` from the database URL instead of atom `:require`. PR #620 normalizes the option; release and health acceptance still require the user-approved merge and deployment.

## Ordered completion after API release

1. Merge #620 under user approval, verify Fly release success and API health. Do not describe PR CI success as deployment acceptance.
2. Deploy Auth's canonical resource map and Import registration reader, retaining unrelated existing secret bindings.
3. Deploy Import with its staged canonical client credential and new preview secret/R2 binding. Deploy Dash with the matching staged Dash credential. Consumer credential rotation must be coordinated with the new Auth reader; the old active consumers have not been assigned the new credentials prematurely.
4. Verify real service-token issuance for each canonical resource and scope without logging credentials or access tokens.
5. With a normally authenticated production session, create new owned test content and verify repository/URL import preview, apply, save and full reload readback; check basic Post reading/co-author and single-Doc Queue flows. Record identities/revisions and remove or retain only those new resources according to their normal ownership rules.
6. Record the production versions, smoke results and cleanup receipt. No production content smoke has been claimed by this preparation document.

The staged consumer credentials are retained privately outside the repository with owner-only file permissions. Their values and tokens must not appear in PRs, logs or evidence.
