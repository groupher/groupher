'use client'

import { useEffect } from 'react'

import { startDevHubReporter } from '../../lib/devHubReporter'

type TProps = {
  serviceId: string
  endpoint?: string
}

export function DevHubReporter({ serviceId, endpoint }: TProps) {
  useEffect(() => startDevHubReporter({ serviceId, endpoint }), [endpoint, serviceId])

  return null
}
