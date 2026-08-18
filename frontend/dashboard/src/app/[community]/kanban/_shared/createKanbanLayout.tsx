'use client'

import { DSB_ROUTE } from '~/const/route'
import type { TTransKey } from '~/spec'

import createCmsSectionLayout from '../../_shared/createCmsSectionLayout'

type TKanbanLayoutConfig = {
  path: string
  title: TTransKey
  crumbTitle: TTransKey
  desc?: TTransKey
  withDivider?: boolean
}

const seg = DSB_ROUTE.KANBAN

/** Creates kanban layout from typed frontend shared inputs. */
export default function createKanbanLayout({
  path,
  title,
  crumbTitle,
  desc,
  withDivider = false,
}: TKanbanLayoutConfig) {
  return createCmsSectionLayout({
    crumbTitle,
    desc,
    path,
    seg,
    showAdmins: true,
    title,
    withDivider,
  })
}
