import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

import { SERVICE_DEPLOYMENT_TARGETS } from '../client/lib/infra-links.ts'
import {
  LOCAL_SERVICE_AUTH_ISSUER,
  LOCAL_SERVICE_ENDPOINTS,
  LOCAL_SERVICE_GRAPHQL_ENDPOINTS,
} from './service-endpoints.ts'
import { REPO_ROOT, SERVICE_DEFINITIONS, SERVICE_RELATIONS } from './services.ts'

test('standalone services declare a four-item technology stack', () => {
  for (const service of SERVICE_DEFINITIONS) {
    assert.equal(service.technologies?.length, 4, service.name)
  }
})

test('frontend and Phoenix stacks match their runtime boundaries', () => {
  const dash = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dash')
  assert.deepEqual(dash?.technologies, ['tanstack-start', 'react', 'typescript', 'tailwindcss'])

  const landing = SERVICE_DEFINITIONS.find((definition) => definition.id === 'landing')
  assert.deepEqual(landing?.technologies, ['tanstack-start', 'react', 'typescript', 'tailwindcss'])
  assert.equal(landing?.config?.kind, 'env-files')

  const community = SERVICE_DEFINITIONS.find((definition) => definition.id === 'community')
  assert.equal(community?.appUrl, 'http://127.0.0.1:3007/home/post')
  assert.equal(community?.portlessAppUrl, 'https://community.groupher.localhost/home/post')

  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dev-gateway')
  assert.deepEqual(gateway?.technologies, ['hono', 'nodejs', 'typescript', 'routing'])
  assert.equal(gateway?.config?.kind, 'env-files')

  const auth = SERVICE_DEFINITIONS.find((definition) => definition.id === 'auth')
  assert.deepEqual(auth?.technologies, ['hono', 'authjs', 'typescript', 'oauth'])
  assert.equal(auth?.config?.kind, 'env-files')

  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')
  assert.deepEqual(phoenix?.technologies, ['phoenix', 'elixir', 'absinthe', 'postgresql'])
  assert.equal(
    phoenix?.localEnvironment?.env?.ASSETS_HUB_BATCH_ENDPOINT,
    LOCAL_SERVICE_ENDPOINTS.assetsHubRead,
  )
  assert.equal(
    phoenix?.localEnvironment?.env?.ASSETS_HUB_DELETE_ENDPOINT,
    LOCAL_SERVICE_ENDPOINTS.assetsHubRead,
  )
  assert.equal(
    phoenix?.localEnvironment?.env?.ASSETS_PUBLIC_ENDPOINT,
    'https://assets.groupher.localhost',
  )
  assert.equal(phoenix?.env, undefined)
})

test('frontend services keep the intended list order', () => {
  assert.deepEqual(
    SERVICE_DEFINITIONS.filter((definition) => definition.group === 'frontend').map(
      (definition) => definition.id,
    ),
    ['landing', 'community', 'dash', 'apply', 'inspire-me', 'widget-sandbox', 'core-vgpu-poc'],
  )
})

test('backend services keep the intended list order', () => {
  assert.deepEqual(
    SERVICE_DEFINITIONS.filter((definition) => definition.group === 'backend').map(
      (definition) => definition.id,
    ),
    [
      'dev-gateway',
      'auth',
      'phoenix',
      'import',
      'press',
      'assets-hub',
      'converter',
      'assets-read-worker',
      'status',
      'review-ai-worker',
      'mock-server',
    ],
  )
})

test('assets hub starts after auth and Phoenix and exposes the local provider readiness contract', () => {
  const assetsHub = SERVICE_DEFINITIONS.find((definition) => definition.id === 'assets-hub')
  assert.deepEqual(assetsHub?.startPolicy, {
    defaultMode: 'chain',
    requiredDependencies: ['auth', 'phoenix'],
    optionalDependencies: [],
  })
  const readWorker = SERVICE_DEFINITIONS.find(
    (definition) => definition.id === 'assets-read-worker',
  )
  assert.equal(readWorker?.url, 'http://127.0.0.1:8787/health/ready')
  assert.equal(readWorker?.portlessUrl, 'https://assets-worker.groupher.localhost/health/ready')
  assert.equal(
    assetsHub?.localEnvironment?.env?.PHOENIX_GRAPHQL_ENDPOINT,
    LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
  )
  assert.equal(
    assetsHub?.localEnvironment?.env?.ASSETS_HUB_BATCH_ENDPOINT,
    LOCAL_SERVICE_ENDPOINTS.assetsHubRead,
  )
})

test('service relations only reference declared services', () => {
  const serviceIds = new Set(SERVICE_DEFINITIONS.map((definition) => definition.id))

  for (const relation of SERVICE_RELATIONS) {
    assert.equal(serviceIds.has(relation.source), true, `${relation.id} source`)
    assert.equal(serviceIds.has(relation.target), true, `${relation.id} target`)
  }
})

test('the request flow documents gateway routing and GraphQL dependencies', () => {
  assert.deepEqual(
    SERVICE_RELATIONS.map(({ source, target, label }) => ({ source, target, label })),
    [
      { source: 'dev-gateway', target: 'auth', label: '/api/auth/*' },
      { source: 'dev-gateway', target: 'landing', label: '/, /pricing, /book-demo' },
      { source: 'dev-gateway', target: 'dash', label: '/:community/dash/*' },
      { source: 'dev-gateway', target: 'apply', label: '/apply/*' },
      { source: 'dev-gateway', target: 'press', label: '*.md, feed.*, llms.txt, sitemap.xml' },
      { source: 'press', target: 'phoenix', label: 'CMS.Press GraphQL projection' },
      { source: 'community', target: 'phoenix', label: 'GraphQL' },
      { source: 'dash', target: 'phoenix', label: 'GraphQL' },
      { source: 'apply', target: 'phoenix', label: 'CommunityApplications GraphQL' },
      { source: 'apply', target: 'assets-hub', label: 'Application Logo upload' },
      { source: 'dash', target: 'import', label: '/api/docs/import/*, /api/artiment/import' },
      { source: 'dash', target: 'assets-hub', label: 'asset upload flow' },
      { source: 'assets-hub', target: 'phoenix', label: 'trusted GraphQL' },
      { source: 'phoenix', target: 'assets-hub', label: 'asset callbacks' },
      { source: 'import', target: 'phoenix', label: 'trusted GraphQL' },
      { source: 'import', target: 'converter', label: 'file conversion' },
    ],
  )
})

test('frontend app start chains match their local routing boundaries', () => {
  const startPolicies = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [definition.id, definition.startPolicy]),
  )

  assert.deepEqual(startPolicies.dash, {
    defaultMode: 'chain',
    requiredDependencies: ['dev-gateway', 'auth', 'phoenix', 'assets-hub'],
    optionalDependencies: ['import', 'converter'],
  })
  assert.deepEqual(startPolicies.landing, {
    defaultMode: 'chain',
    requiredDependencies: ['dev-gateway'],
    optionalDependencies: [],
  })
  assert.deepEqual(startPolicies.community, {
    defaultMode: 'chain',
    requiredDependencies: ['auth', 'phoenix', 'assets-hub'],
    optionalDependencies: [],
  })

  for (const id of ['dev-gateway', 'auth', 'inspire-me', 'phoenix', 'import', 'converter']) {
    assert.equal(startPolicies[id], undefined, id)
  }
})

test('the managed gateway routes to local frontend ports', () => {
  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dev-gateway')

  assert.deepEqual(
    {
      LANDING_SITE: gateway?.localEnvironment?.env?.LANDING_SITE,
      DASH_SITE: gateway?.localEnvironment?.env?.DASH_SITE,
      AUTH_SITE: gateway?.localEnvironment?.env?.AUTH_SITE,
    },
    {
      LANDING_SITE: LOCAL_SERVICE_ENDPOINTS.landing,
      DASH_SITE: LOCAL_SERVICE_ENDPOINTS.dash,
      AUTH_SITE: LOCAL_SERVICE_ENDPOINTS.auth,
    },
  )
})

test('service configuration roots stay scoped to each runtime', () => {
  const configByService = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [
      definition.id,
      definition.config
        ? {
            kind: definition.config.kind,
            root: definition.config.root.replaceAll('\\', '/'),
          }
        : null,
    ]),
  )

  assert.match(configByService.dash?.root || '', /frontend\/dash$/)
  assert.match(configByService.landing?.root || '', /frontend\/landing$/)
  assert.match(configByService['dev-gateway']?.root || '', /infra\/dev-gateway$/)
  assert.match(configByService.auth?.root || '', /backend\/auth$/)
  assert.match(configByService['inspire-me']?.root || '', /frontend\/inspire-me$/)
  assert.match(configByService['import']?.root || '', /backend\/import$/)
  assert.equal(configByService.phoenix?.kind, 'elixir-config')
  assert.match(configByService.phoenix?.root || '', /backend\/api\/config$/)
  assert.equal(configByService.converter, null)
})

test('gateway and auth start through backend Makefile entrypoints', () => {
  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dev-gateway')
  const auth = SERVICE_DEFINITIONS.find((definition) => definition.id === 'auth')

  assert.deepEqual(gateway?.args, ['be.dev-gateway.start.managed'])
  assert.deepEqual(auth?.args, ['be.auth.start.managed'])
})

test('managed Phoenix startup allow-lists only local credential fallbacks', () => {
  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')

  assert.deepEqual(phoenix?.args, ['be.start.managed'])
  assert.equal(phoenix?.env, undefined)

  const makefile = readFileSync(new URL('../../../../Makefile', import.meta.url), 'utf8')
  const managedRecipe = makefile.match(/be\.start\.managed:\n((?:\t.*\n)+)/)?.[1] || ''
  assert.doesNotMatch(managedRecipe, /\.env\.local|\bsource\b|(?:^|\s)\.\s+/)
})

test('Assets Hub local runtime uses shared identity and an explicit R2 credential allowlist', () => {
  const assetsHub = SERVICE_DEFINITIONS.find((definition) => definition.id === 'assets-hub')

  assert.equal(assetsHub?.env, undefined)
  assert.deepEqual(assetsHub?.localEnvironment?.externalEnvKeys, [
    'ASSETS_R2_BUCKET',
    'ASSETS_R2_REGION',
    'ASSETS_R2_ENDPOINT',
    'ASSETS_R2_ACCESS_KEY_ID',
    'ASSETS_R2_SECRET_ACCESS_KEY',
  ])
  assert.equal(assetsHub?.localEnvironment?.serviceAuth?.clientId, 'assets-hub-development')
  assert.equal(assetsHub?.localEnvironment?.env?.ASSETS_HUB_RUNTIME, 'local')
})

test('service identity uses one stable issuer separate from local network endpoints', () => {
  assert.equal(LOCAL_SERVICE_AUTH_ISSUER, 'https://auth.groupher.localhost')

  const serviceAuthDefinitions = SERVICE_DEFINITIONS.filter(
    (definition) => definition.localEnvironment?.env?.SERVICE_AUTH_ISSUER,
  )
  assert.ok(serviceAuthDefinitions.length > 0)

  for (const definition of serviceAuthDefinitions) {
    assert.equal(
      definition.localEnvironment?.env?.SERVICE_AUTH_ISSUER,
      LOCAL_SERVICE_AUTH_ISSUER,
      definition.id,
    )
    assert.equal(
      definition.localEnvironment?.env?.SERVICE_AUTH_TOKEN_ENDPOINT,
      `${LOCAL_SERVICE_ENDPOINTS.auth}/oauth2/token`,
      definition.id,
    )
    assert.equal(
      definition.localEnvironment?.env?.SERVICE_AUTH_JWKS_URL,
      `${LOCAL_SERVICE_ENDPOINTS.auth}/.well-known/jwks.json`,
      definition.id,
    )
  }
})

test('Auth-backed app chains enforce the live Service Identity startup contract', () => {
  const definitions = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [definition.id, definition]),
  )

  assert.equal(definitions.auth?.localEnvironment?.env?.DEV_HUB_SERVICE_AUTH_PROBE, 'true')
  assert.equal(definitions.auth?.env, undefined)
  assert.equal(definitions.dash?.env, undefined)
  assert.equal(definitions.phoenix?.env, undefined)
  for (const id of ['dash', 'apply']) {
    assert.deepEqual(definitions[id]?.startupChecks, [
      {
        healthCheckName: 'phoenix-service-auth',
        id: 'service-auth-contract',
        label: 'Auth to Phoenix Service Identity contract',
        url: `${LOCAL_SERVICE_ENDPOINTS.auth}/health/service-auth`,
      },
    ])
  }
})

test('document converter starts through the repository Makefile entrypoint', () => {
  const converter = SERVICE_DEFINITIONS.find((definition) => definition.id === 'converter')

  assert.equal(converter?.name, 'Converter')
  assert.equal(converter?.cwd, REPO_ROOT)
  assert.deepEqual(converter?.args, ['be.converter.start.managed'])
})

test('import runs in the Cloudflare local runtime', () => {
  const contentImport = SERVICE_DEFINITIONS.find((definition) => definition.id === 'import')

  assert.equal(contentImport?.cwd, REPO_ROOT)
  assert.equal(contentImport?.port, 8001)
  assert.deepEqual(contentImport?.technologies, ['hono', 'cloudflare', 'typescript', 'graphql'])
  assert.deepEqual(contentImport?.args, ['be.import.start.managed'])
})

test('converter and import use matching local and Cloudflare project identities', () => {
  for (const [id, port] of [
    ['converter', 8000],
    ['import', 8001],
  ] as const) {
    const service = SERVICE_DEFINITIONS.find((definition) => definition.id === id)
    assert.equal(service?.command, 'make')
    assert.deepEqual(service?.args, [`be.${id}.start.managed`])
    assert.equal(service?.port, port)
    assert.equal(service?.portlessName, id)
    assert.equal(service?.unavailableReason, undefined)
    assert.ok(service?.technologies?.includes('cloudflare'))
    const deployment = SERVICE_DEPLOYMENT_TARGETS[id]
    assert.equal(deployment?.serviceId, id)
    assert.equal(deployment?.platformId, 'cloudflare')
    assert.ok(deployment?.url.endsWith(`/view/${id}/production`))
    const manifest = JSON.parse(readFileSync(`${REPO_ROOT}/backend/${id}/package.json`, 'utf8'))
    assert.equal(manifest.name, `@groupher/${id}`)
    if (id === 'converter') {
      assert.equal(manifest.scripts['dev:managed'], 'cf dev --mode development')
    } else {
      assert.equal(service?.workerEnvFile, true)
      assert.match(
        manifest.scripts['dev:managed'],
        /^wrangler dev --experimental-new-config --env development --local /,
      )
      assert.ok(manifest.scripts['dev:managed'].includes(`--port ${port}`))
      assert.ok(manifest.scripts['dev:managed'].includes('--env-file "$DEV_HUB_WORKER_ENV_FILE"'))
      assert.ok(
        manifest.scripts['dev:managed'].includes('--persist-to "$DEV_HUB_WORKER_STATE_DIR"'),
      )
      assert.equal(manifest.scripts.deploy, 'cf deploy --mode production')
    }
    assert.equal(manifest.scripts['dev:node'], undefined)
  }
  for (const id of ['content-import', 'document-converter']) {
    assert.equal(
      SERVICE_DEFINITIONS.find((definition) => definition.id === id),
      undefined,
    )
    assert.equal(SERVICE_DEPLOYMENT_TARGETS[id], undefined)
  }

  const dashCloudflareConfig = readFileSync(
    `${REPO_ROOT}/frontend/dash/cloudflare.config.ts`,
    'utf8',
  )
  assert.doesNotMatch(dashCloudflareConfig, /dash-poc|import-poc|mode === 'poc'/)
  assert.match(dashCloudflareConfig, /https:\/\/import\.groupher\.com/)
})

test('dash bulk import routes through the standalone content import service', () => {
  const dash = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dash')
  const contentImport = SERVICE_DEFINITIONS.find((definition) => definition.id === 'import')

  assert.equal(
    dash?.localEnvironment?.env?.NEXT_PUBLIC_ASSETS_HUB_ENDPOINT,
    'https://assets-hub.groupher.localhost',
  )
  assert.equal(
    dash?.localEnvironment?.env?.NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT,
    'https://assets.groupher.localhost',
  )
  assert.equal(
    dash?.localEnvironment?.env?.CONTENT_IMPORT_APP_ENDPOINT,
    LOCAL_SERVICE_ENDPOINTS.import,
  )
  assert.equal(
    contentImport?.localEnvironment?.env?.PHOENIX_GRAPHQL_ENDPOINT,
    LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
  )
  assert.equal(
    contentImport?.localEnvironment?.env?.DOCUMENT_CONVERTER_APP_ENDPOINT,
    LOCAL_SERVICE_ENDPOINTS.converter,
  )
})

test('managed services expose stable Portless names and keep the API under the cookie parent', () => {
  const namedServices = SERVICE_DEFINITIONS.filter((definition) => definition.port !== undefined)

  for (const service of namedServices) {
    assert.ok(service.portlessName, `${service.name} Portless name`)
    assert.equal(new URL(service.portlessUrl || '').hostname.endsWith('.localhost'), true)
  }

  const dash = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dash')
  assert.equal(dash?.portlessUrl, 'https://dash.groupher.localhost/health')
  assert.equal(dash?.appUrl, 'http://127.0.0.1:3005/home/overview')
  assert.equal(dash?.portlessAppUrl, 'https://dash.groupher.localhost/home/overview')

  const readWorker = SERVICE_DEFINITIONS.find(
    (definition) => definition.id === 'assets-read-worker',
  )
  assert.equal(readWorker?.port, 8787)
  assert.equal(readWorker?.portlessUrl, 'https://assets-worker.groupher.localhost/health/ready')
  const assetsHub = SERVICE_DEFINITIONS.find((definition) => definition.id === 'assets-hub')
  assert.deepEqual(
    assetsHub?.endpoints?.map((endpoint) => ({
      id: endpoint.id,
      port: endpoint.port,
      portlessUrl: endpoint.portlessUrl,
    })),
    [{ id: 'local-provider', port: 8002, portlessUrl: 'https://assets.groupher.localhost/health' }],
  )

  for (const id of ['auth', 'landing', 'dash', 'inspire-me', 'import', 'converter']) {
    const service = SERVICE_DEFINITIONS.find((definition) => definition.id === id)
    assert.equal(
      new URL(service?.portlessUrl || '').hostname.endsWith('.groupher.localhost'),
      true,
      id,
    )
  }

  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')
  assert.equal(phoenix?.portlessName, 'api')
  assert.equal(phoenix?.portlessUrl, 'https://api.groupher.localhost/health')
})

test('public development entrypoints route through Dev Hub and service commands stay internal', () => {
  const packageJson = JSON.parse(readFileSync(`${REPO_ROOT}/package.json`, 'utf8')) as {
    scripts: Record<string, string>
  }
  const scripts = packageJson.scripts
  const makefile = readFileSync(`${REPO_ROOT}/Makefile`, 'utf8')
  const makeTarget = (target: string) => {
    const escaped = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return makefile.match(new RegExp(`^${escaped}:\\n((?:\\t.*\\n)+)`, 'm'))?.[1] || ''
  }
  const publicScripts: Record<string, string> = {
    'dev:apply': 'apply',
    'dev:assets-hub': 'assets-hub',
    'dev:assets-read-worker': 'assets-read-worker',
    'dev:auth': 'auth',
    'dev:community': 'community',
    'dev:converter': 'converter',
    'dev:dash': 'dash',
    'dev:dev-gateway': 'dev-gateway',
    'dev:edge-router': 'edge-router',
    'dev:import': 'import',
    'dev:inspire-me': 'inspire-me',
    'dev:landing': 'landing',
    'dev:press': 'press',
    'dev:review-ai-worker': 'review-ai-worker',
    'dev:status': 'status',
    'dev:vgpu-poc': 'core-vgpu-poc',
    'dev:widget': 'widget-sandbox',
    'mock:server': 'mock-server',
  }
  const publicTargets: Record<string, string> = {
    'be.assets-hub.start': 'assets-hub',
    'be.assets-read-worker.start': 'assets-read-worker',
    'be.auth.start': 'auth',
    'be.converter.start': 'converter',
    'be.dev-gateway.start': 'dev-gateway',
    'be.edge-router.start': 'edge-router',
    'be.import.start': 'import',
    'be.mock-server.start': 'mock-server',
    'be.press.start': 'press',
    'be.review-ai-worker.start': 'review-ai-worker',
    'be.status.start': 'status',
    'be.start': 'phoenix',
    'fe.dev.apply': 'apply',
    'fe.dev.community': 'community',
    'fe.dev.dash': 'dash',
    'fe.dev.inspire': 'inspire-me',
    'fe.dev.landing': 'landing',
    'fe.dev.widget': 'widget-sandbox',
    'fe.dev.vgpu-poc': 'core-vgpu-poc',
  }

  assert.match(scripts.devhub || '', /^pnpm --filter @groupher\/local-dev-hub exec tsx /)
  for (const [script, serviceId] of Object.entries(publicScripts)) {
    assert.equal(scripts[script], `pnpm devhub start ${serviceId}`, script)
  }
  const packageEntries: Array<{ file: string; scripts: string[]; serviceId: string }> = [
    { file: 'backend/auth/package.json', scripts: ['dev'], serviceId: 'auth' },
    {
      file: 'backend/assets-hub/package.json',
      scripts: ['dev', 'dev:local', 'dev:upload-api'],
      serviceId: 'assets-hub',
    },
    { file: 'backend/converter/package.json', scripts: ['dev'], serviceId: 'converter' },
    { file: 'backend/import/package.json', scripts: ['dev'], serviceId: 'import' },
    { file: 'backend/press/package.json', scripts: ['dev'], serviceId: 'press' },
    { file: 'ops/status/package.json', scripts: ['dev'], serviceId: 'status' },
    {
      file: 'backend/review-ai-worker/package.json',
      scripts: ['dev'],
      serviceId: 'review-ai-worker',
    },
    {
      file: 'infra/edge-router/package.json',
      scripts: ['dev', 'dev:local'],
      serviceId: 'edge-router',
    },
    { file: 'frontend/apply/package.json', scripts: ['dev'], serviceId: 'apply' },
    { file: 'frontend/community/package.json', scripts: ['dev'], serviceId: 'community' },
    { file: 'frontend/dash/package.json', scripts: ['dev'], serviceId: 'dash' },
    { file: 'frontend/inspire-me/package.json', scripts: ['dev'], serviceId: 'inspire-me' },
    { file: 'frontend/landing/package.json', scripts: ['dev'], serviceId: 'landing' },
    { file: 'frontend/mock-server/package.json', scripts: ['dev'], serviceId: 'mock-server' },
    { file: 'frontend/widget/package.json', scripts: ['dev'], serviceId: 'widget-sandbox' },
    { file: 'frontend/core/package.json', scripts: ['poc:vgpu:dev'], serviceId: 'core-vgpu-poc' },
    { file: 'infra/dev-gateway/package.json', scripts: ['dev'], serviceId: 'dev-gateway' },
  ]
  for (const { file, scripts: publicNames, serviceId } of packageEntries) {
    const manifest = JSON.parse(readFileSync(`${REPO_ROOT}/${file}`, 'utf8')) as {
      scripts: Record<string, string>
    }
    for (const name of publicNames) {
      assert.equal(
        manifest.scripts[name],
        `pnpm --dir ../.. devhub start ${serviceId}`,
        `${file} ${name}`,
      )
    }
    assert.ok(
      Object.keys(manifest.scripts).some((name) => name.endsWith(':managed')),
      `${file} has managed entry`,
    )
  }
  const assetsWorker = JSON.parse(
    readFileSync(`${REPO_ROOT}/backend/assets-hub/package.json`, 'utf8'),
  ) as { scripts: Record<string, string> }
  for (const name of ['dev:cloudflare', 'dev:read-worker', 'dev:worker']) {
    assert.equal(
      assetsWorker.scripts[name],
      'pnpm --dir ../.. devhub start assets-read-worker',
      `backend/assets-hub/package.json ${name}`,
    )
  }
  for (const [target, serviceId] of Object.entries(publicTargets)) {
    const commands = makeTarget(target)
      .trim()
      .split('\n')
      .map((command) => command.trim())
    const devHubCommand = `pnpm devhub start ${serviceId}`
    assert.deepEqual(
      commands,
      target === 'be.press.start'
        ? ['pnpm --filter @groupher/press run db:migrate', devHubCommand]
        : [devHubCommand],
      `${target} commands`,
    )
  }
  assert.equal(scripts['dev:content-import'], undefined)
  assert.equal(scripts['dev:document-converter'], undefined)

  for (const service of SERVICE_DEFINITIONS.filter((definition) => definition.command)) {
    const managedTarget = service.args?.[0]
    if (!managedTarget) throw new Error(`${service.id} must have a managed Make target`)
    assert.ok(managedTarget.endsWith('.managed'), `${service.id} must use an internal target`)
    assert.notEqual(makeTarget(managedTarget).trim(), '', `${service.id} internal target exists`)
    assert.doesNotMatch(makeTarget(managedTarget), /pnpm devhub/, `${service.id} cannot recurse`)
  }
})
