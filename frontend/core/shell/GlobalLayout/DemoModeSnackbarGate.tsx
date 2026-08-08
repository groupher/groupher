'use client'

import { lazy, Suspense } from 'react'

import useDsbDemoMode from '~/hooks/useDsbDemoMode'
import ClientOnly from '~/ui/ClientOnly'

const DemoModeSnackbar = lazy(() => import('./DemoModeSnackbar'))

const DemoModeSnackbarGate = () => {
  const isDemoMode = useDsbDemoMode()
  if (!isDemoMode) return null

  return (
    <ClientOnly>
      <Suspense fallback={null}>
        <DemoModeSnackbar />
      </Suspense>
    </ClientOnly>
  )
}

export default DemoModeSnackbarGate
