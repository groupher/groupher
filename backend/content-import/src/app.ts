import { createHash } from 'node:crypto'

import { createHealthResponse } from '@groupher/service/health'
import { hasCronSecret, jsonResponse, readBearerToken } from '@groupher/service/http'
import { Hono } from 'hono'

import { getPreviewStore, sweepExpiredPreviews } from './lib/content-import/core/preview-store'

type TAuthenticatedOptions = {
  backendToken: string
  previewSecret: string
  serverTrustSecret: string
  userRef: string
}

type THandlers = {
  applyPreview: (
    request: Request,
    previewRef: string,
    options: TAuthenticatedOptions,
  ) => Promise<Response>
  cancelPreview: (
    previewRef: string,
    community: string,
    owner: Pick<TAuthenticatedOptions, 'serverTrustSecret' | 'userRef'>,
  ) => Promise<Response>
  createPreview: (request: Request, options: TAuthenticatedOptions) => Promise<Response>
  getPreview: (
    previewRef: string,
    community: string,
    owner: Pick<TAuthenticatedOptions, 'serverTrustSecret' | 'userRef'>,
  ) => Promise<Response>
  sweepExpiredPreviews: () => Promise<number>
}

type TOptions = {
  environment?: Record<string, string | undefined>
  handlers?: Partial<THandlers>
}

const missingHandler = (name: string) => async (): Promise<Response> =>
  json(
    {
      error: {
        code: 'handler_unavailable',
        message: `Content import handler ${name} is not configured.`,
      },
      ok: false,
    },
    503,
  )

const defaultHandlers = {
  applyPreview: missingHandler('applyPreview'),
  cancelPreview: missingHandler('cancelPreview'),
  createPreview: missingHandler('createPreview'),
  getPreview: missingHandler('getPreview'),
  sweepExpiredPreviews: () => sweepExpiredPreviews(getPreviewStore()),
}

const json = jsonResponse

const resolveAuthOptions = (
  request: Request,
  environment: Record<string, string | undefined>,
): TAuthenticatedOptions | Response => {
  const backendToken =
    readBearerToken(request) || request.headers.get('x-groupher-backend-token') || ''
  if (!backendToken.trim()) {
    return json(
      {
        error: { code: 'unauthorized', message: 'Authentication is required.' },
        ok: false,
      },
      401,
    )
  }

  const previewSecret = environment.CONTENT_IMPORT_PREVIEW_SECRET || environment.NEXTAUTH_SECRET
  const serverTrustSecret = environment.GROUPHER_SERVER_TRUST_SECRET
  if (!previewSecret?.trim() || !serverTrustSecret?.trim()) {
    return json(
      {
        error: { code: 'service_unavailable', message: 'Content import is not configured.' },
        ok: false,
      },
      503,
    )
  }

  const configuredUserRef = request.headers.get('x-groupher-user-ref')?.trim()
  const userRef =
    configuredUserRef || createHash('sha256').update(backendToken).digest('base64url').slice(0, 32)

  return {
    backendToken: backendToken.trim(),
    previewSecret: previewSecret.trim(),
    serverTrustSecret: serverTrustSecret.trim(),
    userRef,
  }
}

export const createApp = ({ environment = process.env, handlers = {} }: TOptions = {}) => {
  const app = new Hono()
  const resolvedHandlers: THandlers = { ...defaultHandlers, ...handlers } as THandlers

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'content-import' })))

  app.post('/api/docs/import/previews', (context) => {
    const options = resolveAuthOptions(context.req.raw, environment)
    if (options instanceof Response) return options
    return resolvedHandlers.createPreview(context.req.raw, options)
  })

  app.get('/api/docs/import/previews/:previewRef', (context) => {
    const options = resolveAuthOptions(context.req.raw, environment)
    if (options instanceof Response) return options
    const community = new URL(context.req.url).searchParams.get('community') || ''
    return resolvedHandlers.getPreview(context.req.param('previewRef'), community, {
      serverTrustSecret: options.serverTrustSecret,
      userRef: options.userRef,
    })
  })

  app.delete('/api/docs/import/previews/:previewRef', (context) => {
    const options = resolveAuthOptions(context.req.raw, environment)
    if (options instanceof Response) return options
    const community = new URL(context.req.url).searchParams.get('community') || ''
    return resolvedHandlers.cancelPreview(context.req.param('previewRef'), community, {
      serverTrustSecret: options.serverTrustSecret,
      userRef: options.userRef,
    })
  })

  app.post('/api/docs/import/previews/:previewRef/apply', (context) => {
    const options = resolveAuthOptions(context.req.raw, environment)
    if (options instanceof Response) return options
    return resolvedHandlers.applyPreview(context.req.raw, context.req.param('previewRef'), options)
  })

  app.post('/api/internal/docs-import/sweep', async (context) => {
    if (!hasCronSecret(context.req.raw, environment)) {
      return json({ ok: false }, 401)
    }
    const deleted = await resolvedHandlers.sweepExpiredPreviews()
    return json({ deleted, ok: true })
  })

  return app
}

export default createApp()
