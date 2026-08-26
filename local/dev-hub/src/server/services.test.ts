import assert from 'node:assert/strict'
import test from 'node:test'

import { LOCAL_SERVICE_ENDPOINTS, LOCAL_SERVICE_GRAPHQL_ENDPOINTS } from './service-endpoints.ts'
import { REPO_ROOT, SERVICE_DEFINITIONS, SERVICE_RELATIONS } from './services.ts'

test('standalone services declare a four-item technology stack', () => {
  for (const service of SERVICE_DEFINITIONS) {
    if (service.id === 'gatus') continue
    assert.equal(service.technologies?.length, 4, service.name)
  }
})

test('Gatus is an infra service with HTTP readiness', () => {
  const gatus = SERVICE_DEFINITIONS.find((definition) => definition.id === 'gatus')
  assert.equal(gatus?.group, 'infra')
  assert.equal(gatus?.readiness, 'http-status')
  assert.deepEqual(gatus?.args, ['ops/status/start-local.sh'])
})

test('frontend and Phoenix stacks match their runtime boundaries', () => {
  const dash = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dash')
  assert.deepEqual(dash?.technologies, ['tanstack-start', 'react', 'typescript', 'tailwindcss'])

  const landing = SERVICE_DEFINITIONS.find((definition) => definition.id === 'landing')
  assert.deepEqual(landing?.technologies, ['tanstack-start', 'react', 'typescript', 'tailwindcss'])
  assert.equal(landing?.config?.kind, 'env-files')

  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dev-gateway')
  assert.deepEqual(gateway?.technologies, ['hono', 'nodejs', 'typescript', 'routing'])
  assert.equal(gateway?.config?.kind, 'env-files')

  const auth = SERVICE_DEFINITIONS.find((definition) => definition.id === 'auth')
  assert.deepEqual(auth?.technologies, ['hono', 'authjs', 'typescript', 'oauth'])
  assert.equal(auth?.config?.kind, 'env-files')

  const phoenix = SERVICE_DEFINITIONS.find((definition) => definition.id === 'phoenix')
  assert.deepEqual(phoenix?.technologies, ['phoenix', 'elixir', 'absinthe', 'postgresql'])
})

test('frontend services keep the intended list order', () => {
  assert.deepEqual(
    SERVICE_DEFINITIONS.filter((definition) => definition.group === 'frontend').map(
      (definition) => definition.id,
    ),
    ['landing', 'community', 'dash', 'apply', 'inspire-me'],
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
      'content-import',
      'press',
      'assets-hub',
      'document-converter',
    ],
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
      { source: 'dash', target: 'content-import', label: '/api/docs/import/*' },
      { source: 'dash', target: 'assets-hub', label: 'asset upload flow' },
      { source: 'assets-hub', target: 'phoenix', label: 'trusted GraphQL' },
      { source: 'phoenix', target: 'assets-hub', label: 'asset callbacks' },
      { source: 'content-import', target: 'phoenix', label: 'trusted GraphQL' },
      { source: 'content-import', target: 'document-converter', label: 'file conversion' },
      {
        source: 'dash',
        target: 'document-converter',
        label: '/api/artiment/import -> /convert',
      },
    ],
  )
})

test('frontend app start chains match their local routing boundaries', () => {
  const startPolicies = Object.fromEntries(
    SERVICE_DEFINITIONS.map((definition) => [definition.id, definition.startPolicy]),
  )

  assert.deepEqual(startPolicies.dash, {
    defaultMode: 'chain',
    requiredDependencies: ['dev-gateway', 'auth', 'phoenix'],
    optionalDependencies: ['assets-hub', 'content-import', 'document-converter'],
  })
  assert.deepEqual(startPolicies.landing, {
    defaultMode: 'chain',
    requiredDependencies: ['dev-gateway'],
    optionalDependencies: [],
  })
  assert.deepEqual(startPolicies.community, {
    defaultMode: 'chain',
    requiredDependencies: ['phoenix'],
    optionalDependencies: [],
  })

  for (const id of [
    'dev-gateway',
    'auth',
    'inspire-me',
    'phoenix',
    'assets-hub',
    'content-import',
    'document-converter',
  ]) {
    assert.equal(startPolicies[id], undefined, id)
  }
})

test('the managed gateway routes to local frontend ports', () => {
  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dev-gateway')

  assert.deepEqual(
    {
      LANDING_SITE: gateway?.env?.LANDING_SITE,
      DASH_SITE: gateway?.env?.DASH_SITE,
      AUTH_SITE: gateway?.env?.AUTH_SITE,
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
  assert.match(configByService['content-import']?.root || '', /backend\/content-import$/)
  assert.equal(configByService.phoenix?.kind, 'elixir-config')
  assert.match(configByService.phoenix?.root || '', /backend\/api\/config$/)
  assert.match(configByService['document-converter']?.root || '', /backend\/document-converter$/)
})

test('gateway and auth start through backend Makefile entrypoints', () => {
  const gateway = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dev-gateway')
  const auth = SERVICE_DEFINITIONS.find((definition) => definition.id === 'auth')

  assert.deepEqual(gateway?.args, ['be.dev-gateway.start'])
  assert.deepEqual(auth?.args, ['be.auth.start'])
})

test('document converter starts through the repository Makefile entrypoint', () => {
  const converter = SERVICE_DEFINITIONS.find((definition) => definition.id === 'document-converter')

  assert.equal(converter?.name, 'Document-converter')
  assert.equal(converter?.cwd, REPO_ROOT)
  assert.deepEqual(converter?.args, ['be.document-converter.start'])
})

test('content import runs as a standalone Node service', () => {
  const contentImport = SERVICE_DEFINITIONS.find((definition) => definition.id === 'content-import')

  assert.equal(contentImport?.cwd, REPO_ROOT)
  assert.equal(contentImport?.port, 8001)
  assert.deepEqual(contentImport?.technologies, ['hono', 'nodejs', 'typescript', 'graphql'])
  assert.deepEqual(contentImport?.args, ['be.content-import.start'])
})

test('dash bulk import routes through the standalone content import service', () => {
  const dash = SERVICE_DEFINITIONS.find((definition) => definition.id === 'dash')
  const contentImport = SERVICE_DEFINITIONS.find((definition) => definition.id === 'content-import')

  assert.equal(dash?.env?.NEXT_PUBLIC_ASSETS_HUB_ENDPOINT, 'https://assets-hub.groupher.localhost')
  assert.equal(dash?.env?.NEXT_PUBLIC_ASSETS_HUB_READ_ENDPOINT, 'https://assets.groupher.localhost')
  assert.equal(dash?.env?.CONTENT_IMPORT_APP_ENDPOINT, LOCAL_SERVICE_ENDPOINTS.contentImport)
  assert.equal(
    contentImport?.env?.PHOENIX_GRAPHQL_ENDPOINT,
    LOCAL_SERVICE_GRAPHQL_ENDPOINTS.phoenix,
  )
  assert.equal(
    contentImport?.env?.DOCUMENT_CONVERTER_APP_ENDPOINT,
    LOCAL_SERVICE_ENDPOINTS.documentConverter,
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

  const assetsHub = SERVICE_DEFINITIONS.find((definition) => definition.id === 'assets-hub')
  assert.deepEqual(
    assetsHub?.endpoints?.map((endpoint) => ({
      id: endpoint.id,
      port: endpoint.port,
      portlessUrl: endpoint.portlessUrl,
    })),
    [
      {
        id: 'upload-api',
        port: 8002,
        portlessUrl: 'https://assets-hub.groupher.localhost/health',
      },
      {
        id: 'read-worker',
        port: 8787,
        portlessUrl: 'https://assets.groupher.localhost/health',
      },
    ],
  )

  for (const id of [
    'auth',
    'landing',
    'dash',
    'inspire-me',
    'content-import',
    'document-converter',
  ]) {
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
