/**
 * Development entrypoint only. Phoenix admits the real DB and registered identity.
 *
 * Business position:
 *   Local browser + CSRF -> development Auth -> local Phoenix DB/actor admission -> session cookies
 */
import type { TBrowserSigninResult } from './auth'
import { createDevelopmentSessionResponse } from './development-session'

const ENDPOINT = 'http://127.0.0.1:4001/__local-test/actors'

/** Requires Hub-only credentials and rejects deployment environment markers. */
export const localTestActorsEnabled = (env: NodeJS.ProcessEnv): boolean =>
  env.DEV_HUB_MANAGED_ENVIRONMENT === 'true' &&
  env.CI !== 'true' &&
  (env.LOCAL_TEST_ACTORS_SECRET?.length || 0) >= 32 &&
  Boolean(env.NEXTAUTH_SECRET) &&
  ['NODE_ENV', 'CLOUDFLARE_ENV', 'ENVIRONMENT'].every((key) =>
    ['', 'dev', 'development', 'local'].includes(env[key]?.trim().toLowerCase() || ''),
  )

/** Admits only registered test identities, then signs normal browser cookies. */
export const localTestActorLogin =
  (env: NodeJS.ProcessEnv = process.env, requestBackend: typeof fetch = fetch) =>
  async (request: Request): Promise<Response> => {
    const body = await request
      .clone()
      .json()
      .catch(() => ({}))
    if (!body || typeof body !== 'object') return new Response(null, { status: 400 })
    if (!Object.hasOwn(body, 'localActor')) {
      return Response.json({ code: 'LOCAL_TEST_ACTOR_REQUIRED' }, { status: 400 })
    }
    if (
      !localTestActorsEnabled(env) ||
      new URL(request.url).hostname !== 'auth.groupher.localhost' ||
      ![
        'https://dash.groupher.localhost',
        'https://community.groupher.localhost',
        'https://groupher.localhost',
      ].includes(request.headers.get('origin') || '')
    ) {
      return new Response(null, { status: 404 })
    }
    const actor = body.localActor
    if (!actor || !['run', 'alias', 'community'].every((key) => typeof actor[key] === 'string')) {
      return Response.json({ code: 'INVALID_LOCAL_TEST_ACTOR' }, { status: 400 })
    }
    const call = (command: string, extra: Record<string, unknown> = {}) =>
      requestBackend(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Groupher-Local-Test': env.LOCAL_TEST_ACTORS_SECRET!,
        },
        body: JSON.stringify({
          run: actor.run,
          alias: actor.alias,
          community: actor.community,
          app: actor.app || 'dash',
          command,
          ...extra,
        }),
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      })
    let result: Response
    try {
      result = await call('actor.login', { userAgent: request.headers.get('user-agent') || '' })
    } catch {
      return Response.json({ code: 'LOCAL_TEST_BACKEND_UNAVAILABLE' }, { status: 503 })
    }
    if (!result.ok) return Response.json({ code: 'LOCAL_TEST_ACTOR_DENIED' }, { status: 403 })
    const { data } = (await result.json()) as { data: TBrowserSigninResult & { login: string } }
    try {
      return await createDevelopmentSessionResponse(
        data,
        data.login,
        data.login,
        env.NEXTAUTH_SECRET!,
      )
    } catch {
      await call('actor.revoke', { sessionRef: data.browserSessionRef })
      return Response.json({ code: 'LOCAL_TEST_SESSION_FAILED' }, { status: 503 })
    }
  }
