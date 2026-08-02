import { buildProxyHeaders } from './headers.js'

export const proxyRequest = (request, target, fetcher = fetch) => {
  const init = {
    method: request.method,
    headers: buildProxyHeaders(request, target),
    redirect: 'manual',
    body: ['GET', 'HEAD'].includes(request.method.toUpperCase()) ? null : request.body,
  }

  return fetcher(target.url, init)
}
