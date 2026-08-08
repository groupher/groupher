export const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { 'Cache-Control': 'no-store' }, status })

export const jsonError = (code: string, message: string, status = 400): Response =>
  jsonResponse({ error: { code, message }, ok: false }, status)
