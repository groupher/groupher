import { createContext } from 'react'

import type { TDsb } from '~/spec'

export const DsbContext = createContext<TDsb | null>(null)

DsbContext.displayName = 'Dsb'
