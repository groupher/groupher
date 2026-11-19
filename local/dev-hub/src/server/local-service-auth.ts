/**
 * Keep the historical setup-auth CLI spelling as an alias for shared preparation.
 *
 * setup-auth -> local-environment state -> Dev Hub -> Auth / Dash
 */
import { prepareLocalEnvironment } from './local-environment.ts'
import { REPO_ROOT } from './services.ts'

/** Prepare the shared local identity without writing application dotenv files. */
export async function setupLocalServiceAuth(
  root = REPO_ROOT,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<{ ready: true }> {
  await prepareLocalEnvironment(root, environment)
  return { ready: true }
}
