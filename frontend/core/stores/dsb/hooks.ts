'use client'

import { use } from 'react'

import { DsbContext } from './context'

/** Reads the dashboard config supplied by the current host shell. */
export default function useDsb() {
  const config = use(DsbContext)

  if (!config) throw new Error('useDsb must be used within DsbProvider')

  return config
}
