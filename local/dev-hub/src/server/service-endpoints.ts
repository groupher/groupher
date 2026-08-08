export const LOCAL_SERVICE_ENDPOINTS = {
  assetsHub: 'http://127.0.0.1:8002',
  assetsHubRead: 'http://127.0.0.1:8787',
  auth: 'http://127.0.0.1:3004',
  contentImport: 'http://127.0.0.1:8001',
  dash: 'http://127.0.0.1:3005',
  dashboard: 'http://127.0.0.1:3001',
  documentConverter: 'http://127.0.0.1:8000',
  gateway: 'http://127.0.0.1:3003',
  landing: 'http://127.0.0.1:3002',
  main: 'http://127.0.0.1:3000',
  phoenix: 'http://127.0.0.1:4001',
} as const

export const LOCAL_SERVICE_GRAPHQL_ENDPOINTS = {
  phoenix: `${LOCAL_SERVICE_ENDPOINTS.phoenix}/graphiql`,
} as const
