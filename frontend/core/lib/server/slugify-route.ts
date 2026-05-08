import { isValidSlug } from '~/validator'

import { slugify } from './slugify'

type TPayload = {
  value?: string
  fallback?: string
}

export const titleSlugify = async (req: Request) => {
  const payload = (await req.json().catch(() => ({}))) as TPayload
  const value = payload.value?.trim()

  if (!value) {
    return Response.json({ ok: false, error: 'value is required' }, { status: 400 })
  }

  const slug = slugify(value, payload.fallback)

  if (!isValidSlug(slug)) {
    return Response.json({ ok: false, error: 'invalid slug' }, { status: 422 })
  }

  return Response.json({ ok: true, slug })
}
