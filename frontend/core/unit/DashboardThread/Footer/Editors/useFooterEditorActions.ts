import { useCallback, useMemo } from 'react'

import type { TLinkItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
import { FIELD } from '~/unit/DashboardThread/constant'

import { makeDashboardLinkId } from '../../LinkEditor/model'
import useDashboardLinkEditorActions, {
  type TDashboardLinkEditorActions,
} from '../../LinkEditor/useEditorActions'
import { isValidFooterLinks } from './model'

export type TFooterEditorActions = TDashboardLinkEditorActions

const validLinks = (links: readonly TLinkItem[]): TLinkItem[] =>
  isValidFooterLinks(links) ? [...links] : []

export default function useFooterEditorActions(
  sourceLinks: readonly TLinkItem[],
): TFooterEditorActions {
  const dsb$ = useDashboard()
  const links = useMemo(() => validLinks(sourceLinks), [sourceLinks])

  const editLinks = useCallback(
    (nextLinks: readonly TLinkItem[]): void => {
      dsb$.editField(FIELD.FOOTER_LINKS, nextLinks)
    },
    [dsb$],
  )

  return useDashboardLinkEditorActions({
    links,
    editLinks,
    makeId: makeDashboardLinkId,
    onEditingLinkChange: (link, mode) => dsb$.commit({ editingLink: link, editingLinkMode: mode }),
  })
}
