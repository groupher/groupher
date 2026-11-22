/**
 * Loads and validates runtime environment values for Assets Hub.
 *
 * Business position:
 *
 *   Dashboard / Phoenix capability
 *     -> Assets Hub module
 *     -> R2 / measured result
 *     -> Phoenix asset state
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'

import dotenv from 'dotenv'

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const localIdentityKeys = ['SERVICE_AUTH_CLIENT_ID', 'SERVICE_AUTH_CLIENT_SECRET'] as const

/**
 * Loads package-local credentials ahead of inherited workspace credentials in local mode.
 *
 * Service auth uses shared environment names across processes. A shell or process manager that
 * previously started Phoenix can therefore leak Phoenix's client identity into Assets Hub.
 */
export const loadAssetsHubEnvironment = (
  environment: Record<string, string | undefined> = process.env,
  root = packageRoot,
): void => {
  if (environment.DEV_HUB_MANAGED_ENVIRONMENT === 'true') return

  const fileEnvironment: Record<string, string> = {}

  dotenv.config({
    path: path.join(root, '.env'),
    processEnv: fileEnvironment,
    quiet: true,
  })

  for (const [key, value] of Object.entries(fileEnvironment)) {
    if (!environment[key]?.trim()) environment[key] = value
  }

  const localRuntime = environment.ASSETS_HUB_RUNTIME === 'local'
  if (localRuntime) {
    for (const key of localIdentityKeys) {
      if (fileEnvironment[key]?.trim()) environment[key] = fileEnvironment[key]
      else delete environment[key]
    }

    if (!environment.ASSETS_HUB_LOCAL_STORAGE_DIR?.trim()) {
      environment.ASSETS_HUB_LOCAL_STORAGE_DIR = path.resolve(root, '../..', '.local/assets-hub')
    }
  }
}

loadAssetsHubEnvironment()
