import type { ReactNode } from 'react'
import Drawer from '~/widgets/@Drawer'

type TProps = {
  children: ReactNode
  resetKey?: string | number
  dismissible?: boolean
}

export default function PreviewDrawerShell({ children, resetKey, dismissible = true }: TProps) {
  return (
    <Drawer resetKey={resetKey} dismissible={dismissible}>
      {children}
    </Drawer>
  )
}
