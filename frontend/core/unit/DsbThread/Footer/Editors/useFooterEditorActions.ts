import { useCallback, useMemo } from 'react'

import { isValidFooterLinks } from '~/lib/footerLinks'
import type { TLinkItem } from '~/spec'
import useDsb from '~/stores/dsb/hooks'
import { FIELD } from '~/unit/DsbThread/constant'

import { makeDashboardLinkId } from '../../LinkEditor/model'
import useDashboardLinkEditorActions, {
  type TDashboardLinkEditorActions,
} from '../../LinkEditor/useEditorActions'

export type TFooterEditorActions = TDashboardLinkEditorActions

const validLinks = (links: readonly TLinkItem[]): TLinkItem[] =>
  isValidFooterLinks(links) ? [...links] : []

// Footer group and footer oneline share the low-level link item editor actions.
// Group mode uses the default dashboard footer field; oneline passes an adapter
// that converts the temporary one-group draft back to footerOnelineLinks.
/** Exposes footer editor actions state and actions through the shared React hook boundary. */
export default function useFooterEditorActions(
  sourceLinks: readonly TLinkItem[],
  onEditLinks?: (links: readonly TLinkItem[]) => void,
): TFooterEditorActions {
  const dsb$ = useDsb()
  const links = useMemo(() => validLinks(sourceLinks), [sourceLinks])

  const editLinks = useCallback(
    (nextLinks: readonly TLinkItem[]): void => {
      if (onEditLinks) {
        onEditLinks(nextLinks)
        return
      }

      dsb$.editField(FIELD.FOOTER_LINKS, nextLinks)
    },
    [dsb$, onEditLinks],
  )

  return useDashboardLinkEditorActions({
    links,
    editLinks,
    makeId: makeDashboardLinkId,
    onEditingLinkChange: (link, mode) => dsb$.commit({ editingLink: link, editingLinkMode: mode }),
  })
}
