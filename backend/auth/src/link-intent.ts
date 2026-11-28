/**
 * Implements the Src Link Intent boundary inside Auth.
 *
 * Business position:
 *
 *   Browser / Gateway
 *     -> Auth module
 *     -> OAuth provider / Phoenix Accounts
 *     -> Session cookies or service token
 */

import { randomBytes } from 'node:crypto'

import { oauthProvider, type TOauthProvider } from './oauth-providers'

export const LINK_INTENT_TTL_SECONDS = 10 * 60

export type TLinkIntent = {
  codeVerifier: string
  createdAt: string
  expiresAt: string
  intentRef: string
  nonce: string
  provider: TOauthProvider
  returnTo: string
  browserSessionRef: string
  status: 'pending' | 'consumed'
}

export interface TLinkIntentStorage {
  delete(key: string): Promise<boolean>
  get<T>(key: string): Promise<T | null>
  put<T>(key: string, value: T): Promise<void>
  setAlarm?(scheduledTime: number): Promise<void>
}

const INTENT_REF_PATTERN = /^li_[A-Za-z0-9_-]{20,80}$/

const opaqueRef = (prefix: string): string => `${prefix}${randomBytes(24).toString('base64url')}`

/** Creates code verifier from typed auth inputs. */
export const createCodeVerifier = (): string => `cv_${randomBytes(32).toString('base64url')}`

/** Creates link intent from typed auth inputs. */
export const createLinkIntent = ({
  browserSessionRef,
  provider,
  returnTo,
  now = Date.now(),
}: {
  browserSessionRef: string
  provider: TOauthProvider
  returnTo: string
  now?: number
}): TLinkIntent => {
  const createdAt = new Date(now).toISOString()
  return {
    browserSessionRef,
    codeVerifier: createCodeVerifier(),
    createdAt,
    expiresAt: new Date(now + LINK_INTENT_TTL_SECONDS * 1_000).toISOString(),
    intentRef: opaqueRef('li_'),
    nonce: opaqueRef('ln_'),
    provider,
    returnTo,
    status: 'pending',
  }
}

/** Reports whether valid intent ref at the auth boundary. */
export const isValidIntentRef = (value: string): boolean => INTENT_REF_PATTERN.test(value)

/** Runs the encode link state operation at the auth boundary. */
export const encodeLinkState = (intent: Pick<TLinkIntent, 'intentRef' | 'nonce'>): string =>
  `${intent.intentRef}.${intent.nonce}`

/** Runs the decode link state operation at the auth boundary. */
export const decodeLinkState = (value: string): { intentRef: string; nonce: string } | null => {
  const [intentRef, nonce, extra] = value.split('.')
  if (extra || !intentRef || !nonce || !isValidIntentRef(intentRef)) return null
  return { intentRef, nonce }
}

const decodeIntent = (value: unknown): TLinkIntent | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const intent = value as Partial<TLinkIntent>
  if (
    typeof intent.intentRef !== 'string' ||
    !isValidIntentRef(intent.intentRef) ||
    typeof intent.nonce !== 'string' ||
    typeof intent.codeVerifier !== 'string' ||
    typeof intent.browserSessionRef !== 'string' ||
    typeof intent.returnTo !== 'string' ||
    typeof intent.provider !== 'string' ||
    !oauthProvider(intent.provider) ||
    (intent.status !== 'pending' && intent.status !== 'consumed') ||
    typeof intent.createdAt !== 'string' ||
    Number.isNaN(Date.parse(intent.createdAt)) ||
    typeof intent.expiresAt !== 'string' ||
    Number.isNaN(Date.parse(intent.expiresAt))
  ) {
    return null
  }
  return intent as TLinkIntent
}

export class LinkIntentObject {
  constructor(private readonly state: { storage: TLinkIntentStorage }) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'PUT' && url.pathname === '/intent') {
      const intent = decodeIntent(await request.json())
      if (!intent) return Response.json({ code: 'INVALID_INTENT' }, { status: 400 })
      const existing = await this.state.storage.get<TLinkIntent>('intent')
      if (existing) return Response.json({ code: 'INTENT_EXISTS' }, { status: 409 })
      await this.state.storage.put('intent', intent)
      await this.state.storage.setAlarm?.(Date.parse(intent.expiresAt))
      return new Response(null, { status: 204 })
    }

    if (request.method === 'GET' && url.pathname === '/intent') {
      const intent = await this.state.storage.get<TLinkIntent>('intent')
      return intent
        ? Response.json(intent, { headers: { 'cache-control': 'no-store' } })
        : new Response(null, { status: 404 })
    }

    if (request.method === 'POST' && url.pathname === '/consume') {
      const body = (await request.json().catch(() => ({}))) as { now?: unknown }
      const now = typeof body.now === 'number' ? body.now : Date.now()
      const intent = await this.state.storage.get<TLinkIntent>('intent')
      if (!intent || intent.status !== 'pending' || Date.parse(intent.expiresAt) <= now) {
        return new Response(null, { status: 409 })
      }
      const consumed = { ...intent, status: 'consumed' as const }
      await this.state.storage.put('intent', consumed)
      return Response.json(consumed, { headers: { 'cache-control': 'no-store' } })
    }

    return new Response(null, { status: 404 })
  }

  async alarm(): Promise<void> {
    await this.state.storage.delete('intent')
  }
}
