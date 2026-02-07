'use client'

import { useSearchParams } from 'next/navigation'
import { useMemo } from 'react'

export const ALLOWED_QUERY_KEYS = ['mode', 'other'] as const

const pickSearchParams = (
  searchParams: URLSearchParams | null,
  allowlist: readonly string[],
): URLSearchParams => {
  const safeParams = new URLSearchParams()
  if (!searchParams) return safeParams

  for (const key of allowlist) {
    const value = searchParams.get(key)
    if (value !== null) {
      safeParams.set(key, value)
    }
  }

  return safeParams
}

const useURLSearchParams = (allowlist: readonly string[] = ALLOWED_QUERY_KEYS): string => {
  const searchParams = useSearchParams()

  return useMemo(() => {
    const safeQuery = pickSearchParams(searchParams, allowlist)
    const queryString = safeQuery.toString()
    return queryString ? `?${queryString}` : ''
  }, [allowlist, searchParams])
}

export default useURLSearchParams
