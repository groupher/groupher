/**
 * Composes the Content Import HTTP application and its injected route dependencies.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

import { GROUPHER_USER_AUTHORIZATION_HEADER } from '@groupher/contracts/headers'
import {
  bearerToken,
  createServiceAuthVerifier,
  serviceTokenErrorStatus,
  type TServiceAuthVerifier,
} from '@groupher/service/auth'
import { createHealthResponse } from '@groupher/service/health'
import { jsonResponse } from '@groupher/service/http'
import { Hono } from 'hono'

import { getPreviewStore, sweepExpiredPreviews } from './lib/content-import/core/preview-store'
import { resolveDelegationSubject } from './lib/groupherGraphql'

type TAuthenticatedOptions = {
  backendToken: string
  previewSecret: string
  serviceSubject: string
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
    owner: Pick<TAuthenticatedOptions, 'serviceSubject' | 'userRef'>,
  ) => Promise<Response>
  createPreview: (request: Request, options: TAuthenticatedOptions) => Promise<Response>
  getPreview: (
    previewRef: string,
    community: string,
    owner: Pick<TAuthenticatedOptions, 'serviceSubject' | 'userRef'>,
  ) => Promise<Response>
  sweepExpiredPreviews: () => Promise<number>
}

type TOptions = {
  environment?: Record<string, string | undefined>
  handlers?: Partial<THandlers>
  resolveDelegationSubject?: (backendToken: string) => Promise<string | null>
  serviceTokenVerifier?: TServiceAuthVerifier
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

const resolveAuthOptions = async (
  request: Request,
  environment: Record<string, string | undefined>,
  verifier: TServiceAuthVerifier,
  resolveSubject: (backendToken: string) => Promise<string | null>,
): Promise<TAuthenticatedOptions | Response> => {
  const serviceToken = bearerToken(request.headers.get('authorization') || undefined)
  const delegatedAuthorization = request.headers.get(GROUPHER_USER_AUTHORIZATION_HEADER)
  const backendToken = delegatedAuthorization?.startsWith('Bearer ')
    ? delegatedAuthorization.slice(7).trim()
    : ''
  if (!backendToken.trim()) {
    return json(
      {
        error: { code: 'unauthorized', message: 'Authentication is required.' },
        ok: false,
      },
      401,
    )
  }

  if (!serviceToken) return json({ error: { code: 'unauthorized' }, ok: false }, 401)
  try {
    const actor = await verifier.verify(serviceToken, 'docs:import:proxy')
    if (actor.subject !== 'service:dashboard') {
      return json({ error: { code: 'forbidden' }, ok: false }, 403)
    }
  } catch (error) {
    const status = serviceTokenErrorStatus(error)
    return json(
      { error: { code: status === 403 ? 'forbidden' : 'unauthorized' }, ok: false },
      status,
    )
  }

  const previewSecret = environment.CONTENT_IMPORT_PREVIEW_SECRET || environment.NEXTAUTH_SECRET
  if (!previewSecret?.trim()) {
    return json(
      {
        error: { code: 'service_unavailable', message: 'Content import is not configured.' },
        ok: false,
      },
      503,
    )
  }

  const userRef = await resolveSubject(backendToken).catch(() => null)
  if (!userRef) {
    return json(
      {
        error: { code: 'unauthorized', message: 'The delegated user credential is invalid.' },
        ok: false,
      },
      401,
    )
  }

  return {
    backendToken: backendToken.trim(),
    previewSecret: previewSecret.trim(),
    serviceSubject: 'service:dashboard',
    userRef,
  }
}

/** Creates the content import application with injectable runtime dependencies. */
export const createApp = ({
  environment = process.env,
  handlers = {},
  resolveDelegationSubject: resolveSubject = resolveDelegationSubject,
  serviceTokenVerifier,
}: TOptions = {}) => {
  const app = new Hono()
  const resolvedHandlers: THandlers = { ...defaultHandlers, ...handlers } as THandlers
  const verifier =
    serviceTokenVerifier ||
    createServiceAuthVerifier({
      audience: 'content-import:internal-api',
      issuer: environment.SERVICE_AUTH_ISSUER || 'https://auth.groupher.com',
      jwksUrl:
        environment.SERVICE_AUTH_JWKS_URL || 'https://auth.groupher.com/.well-known/jwks.json',
    })

  app.get('/health', (context) => context.json(createHealthResponse({ service: 'content-import' })))

  app.post('/api/docs/import/previews', async (context) => {
    const options = await resolveAuthOptions(context.req.raw, environment, verifier, resolveSubject)
    if (options instanceof Response) return options
    return resolvedHandlers.createPreview(context.req.raw, options)
  })

  app.get('/api/docs/import/previews/:previewRef', async (context) => {
    const options = await resolveAuthOptions(context.req.raw, environment, verifier, resolveSubject)
    if (options instanceof Response) return options
    const community = new URL(context.req.url).searchParams.get('community') || ''
    return resolvedHandlers.getPreview(context.req.param('previewRef'), community, {
      serviceSubject: options.serviceSubject,
      userRef: options.userRef,
    })
  })

  app.delete('/api/docs/import/previews/:previewRef', async (context) => {
    const options = await resolveAuthOptions(context.req.raw, environment, verifier, resolveSubject)
    if (options instanceof Response) return options
    const community = new URL(context.req.url).searchParams.get('community') || ''
    return resolvedHandlers.cancelPreview(context.req.param('previewRef'), community, {
      serviceSubject: options.serviceSubject,
      userRef: options.userRef,
    })
  })

  app.post('/api/docs/import/previews/:previewRef/apply', async (context) => {
    const options = await resolveAuthOptions(context.req.raw, environment, verifier, resolveSubject)
    if (options instanceof Response) return options
    return resolvedHandlers.applyPreview(context.req.raw, context.req.param('previewRef'), options)
  })

  app.post('/api/internal/docs-import/sweep', async (context) => {
    const token = bearerToken(context.req.header('authorization'))
    if (!token) return json({ ok: false }, 401)
    try {
      const actor = await verifier.verify(token, 'docs:import:sweep')
      if (actor.subject !== 'service:dashboard') return json({ ok: false }, 403)
    } catch (error) {
      return json({ ok: false }, serviceTokenErrorStatus(error))
    }
    const deleted = await resolvedHandlers.sweepExpiredPreviews()
    return json({ deleted, ok: true })
  })

  return app
}

export default createApp()
