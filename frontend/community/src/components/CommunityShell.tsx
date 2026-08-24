import type { ReactNode } from 'react'

import { GlobalProvider } from '~/app/providers'
import CommunityDigest from '~/unit/CommunityDigest'

export default function CommunityShell({ children }: { children: ReactNode }) {
  return (
    <GlobalProvider>
      <div className='column w-full'>
        <CommunityDigest />
        <div className='w-full'>{children}</div>
      </div>
    </GlobalProvider>
  )
}
