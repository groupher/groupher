/**
 * Declares the Import Worker and its local/production Cloudflare bindings.
 *
 * cf dev / deploy -> Import HTTP API -> Workflows and R2 -> Phoenix
 */
import { bindings, defineConfig, exports } from 'cf/config'

export default defineConfig(({ mode }) => {
  if (mode !== 'production' && mode !== 'development') {
    throw new Error('Import supports only development and production modes.')
  }
  const production = mode === 'production'
  const workerName = 'import'
  const analysisWorkflowName = 'import-analysis'
  const applyWorkflowName = 'import-apply'

  return {
    worker: {
      name: workerName,
      compatibilityDate: '2026-10-03',
      compatibilityFlags: ['nodejs_compat', 'nodejs_compat_populate_process_env'],
      entrypoint: './cf-worker.ts',
      observability: { enabled: true },
      ...(production ? { domains: ['import.groupher.com'] } : {}),
      env: {
        ENVIRONMENT: bindings.text(production ? 'production' : 'development'),
        CONTENT_IMPORT_PREVIEW_SECRET: bindings.secret(),
        PHOENIX_GRAPHQL_ENDPOINT: bindings.text(
          production ? 'https://api.groupher.com/graphiql' : 'http://127.0.0.1:4001/graphiql',
        ),
        SERVICE_AUTH_ISSUER: bindings.text(
          production ? 'https://auth.groupher.com' : 'https://auth.groupher.localhost',
        ),
        SERVICE_AUTH_JWKS_URL: bindings.text(
          production
            ? 'https://auth.groupher.com/.well-known/jwks.json'
            : 'http://127.0.0.1:3004/.well-known/jwks.json',
        ),
        SERVICE_AUTH_TOKEN_ENDPOINT: bindings.text(
          production
            ? 'https://auth.groupher.com/oauth2/token'
            : 'http://127.0.0.1:3004/oauth2/token',
        ),
        SERVICE_AUTH_CLIENT_ID: bindings.secret(),
        SERVICE_AUTH_CLIENT_SECRET: bindings.secret(),
        CONTENT_IMPORT_SERVICE_AUTH_AUDIENCE: bindings.text('content-import:internal-api'),
        SERVICE_AUTH_PHOENIX_RESOURCE: bindings.text('https://api.groupher.com/content-import'),
        DOCUMENT_CONVERTER_APP_ENDPOINT: bindings.text(
          production ? 'https://converter.groupher.com' : 'http://127.0.0.1:8000',
        ),
        ARTIFACTS: bindings.r2({ name: 'groupher-content-import' }),
        ANALYSIS_WORKFLOW: bindings.workflow({
          name: analysisWorkflowName,
          worker: workerName,
          exportName: 'ImportWorkflow',
        }),
        APPLY_WORKFLOW: bindings.workflow({
          name: applyWorkflowName,
          worker: workerName,
          exportName: 'ApplyWorkflow',
        }),
      },
      exports: {
        ImportWorkflow: exports.workflow({ name: analysisWorkflowName }),
        ApplyWorkflow: exports.workflow({ name: applyWorkflowName }),
      },
    },
  }
})
