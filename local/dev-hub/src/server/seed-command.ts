export const SEED_HELP = `Local development seed commands (run from the intended checkout):

  pnpm seed actor create --run <run> --alias <alias>
  pnpm seed actor list --run <run>
  pnpm seed community create --run <run> --owner <alias> --slug <slug> [--title <title>]
  pnpm seed community request-destroy --run <run> --by <alias> --slug <slug>
  pnpm seed admin invite --run <run> --community <slug> --by <alias> --to <alias> --key <key> --permissions <keys>
  pnpm seed admin accept --run <run> --as <alias> --invite <key>
  pnpm seed admin set-permissions --run <run> --community <slug> --by <alias> --member <alias> --key <key> --permissions <keys> [--revision <n>]
  pnpm seed admin remove --run <run> --community <slug> --by <alias> --member <alias> --key <key> [--revision <n>]
  pnpm seed article create --run <run> --as <alias> --community <slug> --thread post [--key <key>] [--title <title>] [--markdown <text>] [--publish]
  pnpm seed case theme-edit-permission --run <run> --community <slug>
  pnpm seed case admin-invitation-pending --run <run> --community <slug>
  pnpm seed case admin-invitation-accepted --run <run> --community <slug>
  pnpm seed home prepare
  pnpm seed cleanup run --run <run> [--apply]
  pnpm seed cleanup run --run <run> --apply --retain-unconfirmed <operation-ref> --reason <text>

Append --json for structured output. Cleanup without --apply is read-only.
Unconfirmed Article retention currently refuses when downstream terminal evidence is unavailable.
Writes require this checkout's managed Hub, Phoenix and an admitted local development database.
See backend/api/dev/seed/README.md for examples and docs/architecture/local-seed-toolkit.md for recovery semantics.`

/** Attach the checkout and run to machine-readable results without changing legacy output. */
export function formatSeedResult(args: string[], environment: string, result: unknown) {
  const runIndex = args.indexOf('--run')
  const status =
    result && typeof result === 'object' && 'status' in result && typeof result.status === 'string'
      ? result.status
      : 'completed'
  return {
    environment,
    run: runIndex >= 0 ? args[runIndex + 1] : 'home',
    command: `${args[0]} ${args[1]}`,
    status,
    result,
  }
}

/** Map the public seed spelling to the existing managed fixture client. */
export function mapSeedCommand(args: string[]): string[] {
  const [area, action, ...flags] = args
  const commands: Record<string, [string, string]> = {
    'actor.create': ['actors', 'create'],
    'actor.list': ['actors', 'list'],
    'community.create': ['communities', 'create'],
    'community.request-destroy': ['communities', 'request-destroy'],
    'admin.invite': ['admin', 'invite'],
    'admin.accept': ['admin', 'accept'],
    'admin.set-permissions': ['admin', 'set-permissions'],
    'admin.remove': ['admin', 'remove'],
    'case.theme-edit-permission': ['case', 'theme-edit-permission'],
    'case.admin-invitation-pending': ['case', 'admin-invitation-pending'],
    'case.admin-invitation-accepted': ['case', 'admin-invitation-accepted'],
    'article.create': ['articles', 'create'],
    'cleanup.run': ['actors', 'clean'],
    'home.prepare': ['home', 'prepare'],
  }
  const command = commands[`${area}.${action}`]
  if (!command) throw new Error('Unknown seed command.')
  const jsonFlags = flags.filter((flag) => flag === '--json')
  if (jsonFlags.length > 1) throw new Error('Duplicate --json option.')
  const mappedFlags = flags.filter((flag) => flag !== '--json')
  if (area === 'home') {
    if (mappedFlags.length) throw new Error('home prepare does not accept resource options.')
    return [...command, '--run', 'home']
  }
  if (area === 'community' && !mappedFlags.includes('--slug')) {
    throw new Error('--slug is required for retryable community creation.')
  }
  return [...command, ...mappedFlags]
}
