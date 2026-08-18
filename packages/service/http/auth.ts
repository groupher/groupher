/** Reads bearer token through the bounded service interface. */
export const readBearerToken = (request: Request): string => {
  const authorization = request.headers.get('authorization') || ''
  const [scheme, token] = authorization.split(/\s+/, 2)
  return scheme?.toLowerCase() === 'bearer' ? token?.trim() || '' : ''
}
