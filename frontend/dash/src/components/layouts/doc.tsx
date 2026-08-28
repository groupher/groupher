'use client'

import type { ReactNode } from 'react'

import SubMenuContentLayout from './_shared/SubMenuContentLayout'

export default function DsbDocLayout({ children }: { children: ReactNode }) {
  return <SubMenuContentLayout>{children}</SubMenuContentLayout>
}
