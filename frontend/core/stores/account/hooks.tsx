'use client'

import { use } from 'react'

import { AccountContext } from './context'

export default function Hooks() {
  const account = use(AccountContext)
  if (!account) throw new Error('useAccount must be used within an Account store provider')
  return account
}
