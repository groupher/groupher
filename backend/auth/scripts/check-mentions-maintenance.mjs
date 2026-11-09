/**
 * @module MentionsGraphMaintenanceProbe
 * Checks live Auth issuance and isolated Phoenix capabilities without CMS writes.
 * Credentials -> live Auth -> short-lived JWT -> isolated Phoenix verification
 * Tokens remain in protected temporary files or the SSH input stream.
 */

import { spawnSync } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm, chmod } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const credentialsPath =
  process.env.CMS_MENTIONS_CREDENTIALS_FILE ||
  join(homedir(), '.config/groupher/mentions-maintenance/auth.groupher.com.json')
const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'))
const tokens = {}
const resource = 'https://api.groupher.com/cms-maintenance'
for (const operation of ['initialize', 'rebuild']) {
  const client = credentials[operation]
  const response = await fetch('https://auth.groupher.com/oauth2/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource,
      scope: 'cms:mentions:initialize cms:mentions:rebuild',
    }),
  })
  const result = await response.json()
  if (!response.ok || result.scope !== `cms:mentions:${operation}` || !result.access_token) {
    throw new Error(
      `Live Auth rejected ${operation}: HTTP ${response.status}, ${result.error || 'unexpected capability'}`,
    )
  }
  if (result.expires_in !== 600) throw new Error('Unexpected maintenance token TTL')
  tokens[operation] = result.access_token
  console.log(`Auth ${operation}: HTTP ${response.status}, exact scope, TTL ${result.expires_in}s`)
}
for (const [name, overrides, expectedStatus, expectedError] of [
  ['wrong scope', { scope: 'cms:mentions:rebuild' }, 400, 'invalid_scope'],
  ['wrong resource', { resource: 'https://api.groupher.com/press' }, 400, 'invalid_target'],
  ['wrong credential', { secret: 'invalid-maintenance-credential' }, 401, 'invalid_client'],
]) {
  const client = credentials.initialize
  const response = await fetch('https://auth.groupher.com/oauth2/token', {
    method: 'POST',
    headers: {
      authorization: `Basic ${Buffer.from(`${client.clientId}:${overrides.secret || client.clientSecret}`).toString('base64')}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      resource,
      scope: 'cms:mentions:initialize',
      ...Object.fromEntries(Object.entries(overrides).filter(([key]) => key !== 'secret')),
    }),
  })
  const result = await response.json()
  if (response.status !== expectedStatus || result.error !== expectedError || result.access_token) {
    throw new Error(`Auth did not reject ${name} as expected: HTTP ${response.status}`)
  }
  console.log(`Auth ${name}: rejected (${expectedError})`)
}
if (process.argv.includes('--fly')) {
  const verifier = await readFile(
    join(root, 'backend/api/lib/groupher_server_web/service_auth/verifier.ex'),
    'utf8',
  )
  const authorization = await readFile(
    join(
      root,
      'backend/api/lib/groupher_server/cms/artiment_mentions/maintenance_authorization.ex',
    ),
    'utf8',
  )
  let probe = await readFile(
    join(root, 'backend/api/scripts/verify_mentions_maintenance.exs'),
    'utf8',
  )
  probe = probe.replace(
    'System.fetch_env!("CMS_MENTIONS_AUTH_PROBE_FILE") |> File.read!() |> Jason.decode!()',
    `Jason.decode!(Base.decode64!("${Buffer.from(JSON.stringify(tokens)).toString('base64')}"))`,
  )
  const compile = (source) =>
    `Code.compile_string(Base.decode64!("${Buffer.from(source).toString('base64')}"))\n`
  const quote = (value) => `'${value.replaceAll("'", "'\\''")}'`
  const command =
    'umask 077; p=$(mktemp); cat > "$p"; ' +
    'CMS_MENTIONS_AUTH_PROBE_FILE="$p" /app/bin/groupher_server eval ' +
    quote('Code.eval_file(System.fetch_env!("CMS_MENTIONS_AUTH_PROBE_FILE"))') +
    '; r=$?; rm -f "$p"; exit "$r"'
  const result = spawnSync(
    'fly',
    ['ssh', 'console', '--app', 'groupher-api', '--command', `sh -c ${quote(command)}`],
    {
      input: compile(verifier) + compile(authorization) + probe,
      stdio: ['pipe', 'inherit', 'inherit'],
      timeout: 90000,
    },
  )
  if (result.status !== 0) throw new Error('Isolated target Phoenix capability check failed')
  console.log(
    'Target check used a separate BEAM process; serving release/configuration was unchanged.',
  )
}
const directory = await mkdtemp(join(tmpdir(), 'mentions-maintenance-probe-'))
await chmod(directory, 0o700)
try {
  const input = join(directory, 'tokens.json')
  await writeFile(input, JSON.stringify(tokens), { mode: 0o600 })
  const result = spawnSync(
    'mix',
    ['run', '--no-start', 'scripts/verify_mentions_maintenance.exs'],
    {
      cwd: join(root, 'backend/api'),
      stdio: 'inherit',
      env: { ...process.env, MIX_ENV: 'test', CMS_MENTIONS_AUTH_PROBE_FILE: input },
    },
  )
  if (result.status !== 0) throw new Error('Phoenix capability check failed')
} finally {
  await rm(directory, { recursive: true, force: true })
}
