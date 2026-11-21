import { createDevelopmentLoginResponse } from '../local-dev-login'

/** Creates the requested synthetic E2E identity on the isolated E2E server. */
export const testLogin = async (request: Request): Promise<Response> => {
  const body = (await request.json().catch(() => ({}))) as { login?: unknown }
  const login = typeof body.login === 'string' && body.login.trim() ? body.login.trim() : 'e2e'
  return createDevelopmentLoginResponse(request, login, 'E2E User')
}
