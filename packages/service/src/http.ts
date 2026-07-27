export const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })

export const jsonError = (code: string, message: string, status = 400): Response =>
  jsonResponse({ error: { code, message }, ok: false }, status)

export const readBearerToken = (request: Request): string => {
  const authorization = request.headers.get('authorization') || ''
  const [scheme, token] = authorization.split(/\s+/, 2)
  return scheme?.toLowerCase() === 'bearer' ? token?.trim() || '' : ''
}

export const hasCronSecret = (
  request: Request,
  environment: Record<string, string | undefined>,
): boolean => {
  const secret = environment.CRON_SECRET?.trim()
  return !!secret && request.headers.get('authorization') === `Bearer ${secret}`
}
