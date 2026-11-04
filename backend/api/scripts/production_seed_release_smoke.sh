#!/usr/bin/env bash
# Local host only. Requires Python 3, pnpm, a built prod release and loopback test DB.
set -euo pipefail
seed_api_root=$(cd "$(dirname "$0")/.." && pwd)
python3 - "$seed_api_root" <<'PY'
import base64
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile

api = Path(sys.argv[1])
root = api.parent.parent
release = api / '_build/prod/rel/groupher_server/bin/groupher_server'
if not release.is_file():
    raise SystemExit('Build first: cd backend/api && MIX_ENV=prod mix release --overwrite')
with tempfile.TemporaryDirectory(prefix='groupher-seed-smoke-') as directory:
    artifact = str(Path(directory) / 'bodies.json')
    subprocess.run(['pnpm', '--filter', '@groupher/backend-auth', 'exec', 'tsx', '../../scripts/production-seed-bodybags.mts', 'local-release-smoke', artifact], cwd=root, check=True)
    # Deliberately do not inherit deployment credentials or database endpoints.
    env = {name: value for name, value in os.environ.items() if name in ('PATH', 'LANG', 'TMPDIR', 'SHELL', 'USER')}
    env.update({
        'ALLOW_LOCAL_SEED_SMOKE': 'true', 'PRODUCTION_SEED_SMOKE_ARTIFACT': artifact,
        'SECRET_KEY_BASE': secrets.token_urlsafe(64), 'PHX_JWT_SECRET': secrets.token_urlsafe(64),
        'VIEW_TRACKER_PEPPER': secrets.token_urlsafe(32),
        'PAGINATION_CURSOR_CURRENT_KEY': secrets.token_urlsafe(32),
        'REFERENCE_MAP_KEY': secrets.token_urlsafe(32),
        'MENTION_REBUILD_FAILURE_MANIFEST': str(Path(directory) / 'mention-failures.json'),
        'DATABASE_URL': 'postgres://postgres:postgres@127.0.0.1:5432/groupher_server_test',
        'FLY_APP_NAME': 'seed-local', 'FLY_IMAGE_REF': 'seed-local', 'FLY_PRIVATE_IP': '::1',
        'RELEASE_COOKIE': secrets.token_urlsafe(32),
    })
    encoded = base64.b64encode(str(api / 'scripts/production_seed_release_smoke.exs').encode()).decode()
    subprocess.run([str(release), 'eval', f'Code.eval_file(Base.decode64!("{encoded}"))'], cwd=api, env=env, check=True)
PY
