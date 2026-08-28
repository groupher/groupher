'use client'

import { useLocation } from '@tanstack/react-router'
import { useMemo } from 'react'

const useURLSearchParams = (): URLSearchParams => {
  const { searchStr } = useLocation()

  return useMemo(() => {
    return new URLSearchParams(searchStr)
  }, [searchStr])
}

export default useURLSearchParams
