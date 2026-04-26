'use client'

import dynamic from 'next/dynamic'

import useDsbDemoMode from '~/hooks/useDsbDemoMode'

const DemoModeSnackbar = dynamic(() => import('./DemoModeSnackbar'), {
  ssr: false,
})

const DemoModeSnackbarGate = () => {
  const isDemoMode = useDsbDemoMode()
  if (!isDemoMode) return null

  return <DemoModeSnackbar />
}

export default DemoModeSnackbarGate
