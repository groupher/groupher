import { validateSlug } from './validator'

type TSlugifyResponse = {
  ok: boolean
  slug?: string
  error?: string
}

export const slugify = async (value: string): Promise<string> => {
  const response = await fetch('/api/utils/slugify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ value }),
  })

  const result = (await response.json().catch(() => ({}))) as TSlugifyResponse

  const validation = validateSlug(result.slug)

  if (!response.ok || !result.ok || !validation.valid) {
    throw new Error(result.error || 'Failed to slugify value')
  }

  return validation.value
}
