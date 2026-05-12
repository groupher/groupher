import type { Dispatch, SetStateAction } from 'react'
import { useCallback } from 'react'

import type { TLinkItem } from '~/spec'

import useDashboardLinkEditorActions, {
  type TDashboardLinkEditorActions,
} from '../../LinkEditor/useEditorActions'

type TProps = {
  links: readonly TLinkItem[]
  onChange: Dispatch<SetStateAction<readonly TLinkItem[]>>
  makeId: (prefix: string) => string
}

export type THeaderEditorActions = TDashboardLinkEditorActions

export default function useHeaderEditorActions({
  links,
  makeId,
  onChange,
}: TProps): THeaderEditorActions {
  const editLinks = useCallback(
    (nextLinks: readonly TLinkItem[]): void => {
      onChange(nextLinks)
    },
    [onChange],
  )

  return useDashboardLinkEditorActions({ links, editLinks, makeId })
}
