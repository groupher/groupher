-- OAuth V1 cutover: clear the legacy unbounded provider profile payload.
--
-- This file is an explicitly-run post-deploy data operation. Do not put it in
-- Ecto migrations, execute it at boot, or run it before old writers are
-- drained. It is intentionally forward-only; do not copy raw values to a
-- backup table or restore them during rollback.

BEGIN;

-- Preflight evidence for the runbook. The operator must record this count
-- before continuing and must stop if the release/drain checks are not green.
SELECT count(*) AS non_null_raw_before
FROM account.oauth_providers
WHERE raw IS NOT NULL;

WITH cleared AS (
  UPDATE account.oauth_providers
  SET raw = NULL
  WHERE raw IS NOT NULL
  RETURNING 1
)
SELECT count(*) AS rows_cleared
FROM cleared;

SELECT count(*) AS non_null_raw_after
FROM account.oauth_providers
WHERE raw IS NOT NULL;

COMMIT;
