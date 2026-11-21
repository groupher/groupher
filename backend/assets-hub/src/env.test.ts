import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { loadAssetsHubEnvironment } from './env'

const roots: string[] = []

const createEnvironmentRoot = async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'groupher-assets-env-'))
  roots.push(root)
  await writeFile(
    path.join(root, '.env'),
    [
      'PHOENIX_GRAPHQL_ENDPOINT=http://localhost:4001/graphql',
      'SERVICE_AUTH_CLIENT_ID=assets-hub-development',
      'SERVICE_AUTH_CLIENT_SECRET=assets-secret',
      '',
    ].join('\n'),
  )
  return root
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe('loadAssetsHubEnvironment', () => {
  it('overrides inherited service credentials in the local runtime', async () => {
    const root = await createEnvironmentRoot()
    const environment = {
      ASSETS_HUB_RUNTIME: 'local',
      PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:4001/graphql',
      SERVICE_AUTH_CLIENT_ID: 'phoenix-development',
      SERVICE_AUTH_CLIENT_SECRET: 'phoenix-secret',
    }

    loadAssetsHubEnvironment(environment, root)

    expect(environment).toMatchObject({
      ASSETS_HUB_LOCAL_STORAGE_DIR: path.resolve(root, '../..', '.local/assets-hub'),
      PHOENIX_GRAPHQL_ENDPOINT: 'http://127.0.0.1:4001/graphql',
      SERVICE_AUTH_CLIENT_ID: 'assets-hub-development',
      SERVICE_AUTH_CLIENT_SECRET: 'assets-secret',
    })
  })

  it('preserves an explicit local storage directory', async () => {
    const root = await createEnvironmentRoot()
    const environment = {
      ASSETS_HUB_LOCAL_STORAGE_DIR: '/tmp/custom-assets',
      ASSETS_HUB_RUNTIME: 'local',
    }

    loadAssetsHubEnvironment(environment, root)

    expect(environment.ASSETS_HUB_LOCAL_STORAGE_DIR).toBe('/tmp/custom-assets')
  })

  it('applies local runtime defaults when the runtime comes from the package environment', async () => {
    const root = await createEnvironmentRoot()
    await writeFile(
      path.join(root, '.env'),
      [
        'ASSETS_HUB_RUNTIME=local',
        'SERVICE_AUTH_CLIENT_ID=assets-hub-development',
        'SERVICE_AUTH_CLIENT_SECRET=assets-secret',
        '',
      ].join('\n'),
    )
    const environment: Record<string, string | undefined> = {}

    loadAssetsHubEnvironment(environment, root)

    expect(environment.ASSETS_HUB_LOCAL_STORAGE_DIR).toBe(
      path.resolve(root, '../..', '.local/assets-hub'),
    )
  })

  it('does not mix incomplete package credentials with an inherited service identity', async () => {
    const root = await createEnvironmentRoot()
    await writeFile(
      path.join(root, '.env'),
      [
        'ASSETS_HUB_RUNTIME=local',
        'SERVICE_AUTH_CLIENT_ID=assets-hub-development',
        'SERVICE_AUTH_CLIENT_SECRET=',
        '',
      ].join('\n'),
    )
    const environment: Record<string, string | undefined> = {
      SERVICE_AUTH_CLIENT_ID: 'phoenix-development',
      SERVICE_AUTH_CLIENT_SECRET: 'phoenix-secret',
    }

    loadAssetsHubEnvironment(environment, root)

    expect(environment.SERVICE_AUTH_CLIENT_ID).toBe('assets-hub-development')
    expect(environment.SERVICE_AUTH_CLIENT_SECRET).toBeUndefined()
    expect('SERVICE_AUTH_CLIENT_SECRET' in environment).toBe(false)
  })

  it('clears inherited service credentials when the package environment has no identity', async () => {
    const root = await createEnvironmentRoot()
    await writeFile(path.join(root, '.env'), 'ASSETS_HUB_RUNTIME=local\n')
    const environment: Record<string, string | undefined> = {
      SERVICE_AUTH_CLIENT_ID: 'phoenix-development',
      SERVICE_AUTH_CLIENT_SECRET: 'phoenix-secret',
    }

    loadAssetsHubEnvironment(environment, root)

    expect('SERVICE_AUTH_CLIENT_ID' in environment).toBe(false)
    expect('SERVICE_AUTH_CLIENT_SECRET' in environment).toBe(false)
  })

  it('preserves explicit service credentials outside the local runtime', async () => {
    const root = await createEnvironmentRoot()
    const environment = {
      NODE_ENV: 'production',
      SERVICE_AUTH_CLIENT_ID: 'deployed-assets-hub',
      SERVICE_AUTH_CLIENT_SECRET: 'deployed-secret',
    }

    loadAssetsHubEnvironment(environment, root)

    expect(environment).toMatchObject({
      SERVICE_AUTH_CLIENT_ID: 'deployed-assets-hub',
      SERVICE_AUTH_CLIENT_SECRET: 'deployed-secret',
    })
  })
})
