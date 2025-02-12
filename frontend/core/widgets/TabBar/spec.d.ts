import { ReactNode } from 'react'

export type TTabItem = {
  title?: string
  slug: string
  alias?: string
  icon?: string | ReactNode
  localIcon?: string
  index?: number
}
