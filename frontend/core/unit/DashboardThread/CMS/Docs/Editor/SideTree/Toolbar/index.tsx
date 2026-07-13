import { type ChangeEvent, type ComponentType, type FC, type SVGProps } from 'react'

import useTrans from '~/hooks/useTrans'
import CloseSVG from '~/icons/CloseLight'
import FilePlusSVG from '~/icons/FilePlus'
import FolderPlusSVG from '~/icons/FolderPlus'
import MagnifyingGlassSVG from '~/icons/MagnifyingGlass'
import MapPinPlusSVG from '~/icons/MapPinPlus'
import Input from '~/widgets/Input'

import useSalon from '../salon/toolbar'

type TToolbarAction = {
  key: 'pin' | 'group' | 'doc'
  label:
    | 'dsb.cms.docs.side_tree.action.pin'
    | 'dsb.cms.docs.side_tree.action.group'
    | 'dsb.cms.docs.side_tree.action.doc'
  Icon: ComponentType<SVGProps<SVGSVGElement>>
}

const ACTIONS: TToolbarAction[] = [
  { key: 'pin', label: 'dsb.cms.docs.side_tree.action.pin', Icon: MapPinPlusSVG },
  { key: 'group', label: 'dsb.cms.docs.side_tree.action.group', Icon: FolderPlusSVG },
  { key: 'doc', label: 'dsb.cms.docs.side_tree.action.doc', Icon: FilePlusSVG },
]

type TProps = {
  query: string
  searching: boolean
  onChangeQuery: (query: string) => void
  onCloseSearch: () => void
  onAddPin: () => void
  onAddGroup: () => void
  onOpenSearch: () => void
}

const Toolbar: FC<TProps> = ({
  query,
  searching,
  onChangeQuery,
  onCloseSearch,
  onAddPin,
  onAddGroup,
  onOpenSearch,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  const handleInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    onChangeQuery(event.target.value)
  }

  return (
    <div className={s.wrapper}>
      {searching ? (
        <div className={s.searchField}>
          <MagnifyingGlassSVG className={s.searchInputIcon} />
          <Input
            autoFocus
            testid='docs-side-tree-search-input'
            width='w-full'
            className={s.searchInput}
            value={query}
            placeholder={t('dsb.cms.docs.side_tree.search_placeholder')}
            onChange={handleInputChange}
          />
          <button
            type='button'
            className={s.closeSearch}
            aria-label={t('dsb.cms.docs.side_tree.search_clear')}
            title={t('dsb.cms.docs.side_tree.search_clear')}
            onClick={onCloseSearch}
          >
            <CloseSVG className={s.closeIcon} />
          </button>
        </div>
      ) : (
        <button
          type='button'
          className={s.search}
          aria-label={t('dsb.cms.docs.side_tree.search')}
          title={t('dsb.cms.docs.side_tree.search')}
          onClick={onOpenSearch}
        >
          <MagnifyingGlassSVG className={s.searchIcon} />
          <span className={s.searchText}>{t('dsb.cms.docs.side_tree.search')}</span>
        </button>
      )}

      {!searching && (
        <div className={s.actions}>
          {ACTIONS.map(({ key, label, Icon }) => {
            const actionText = t(label)
            const buttonLabel = `${t('dsb.cms.docs.side_tree.action.add_prefix')} ${actionText}`

            return (
              <button
                key={label}
                type='button'
                className={s.actionButton}
                aria-label={buttonLabel}
                title={buttonLabel}
                onClick={key === 'pin' ? onAddPin : key === 'group' ? onAddGroup : undefined}
              >
                <Icon className={s.actionIcon} />
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default Toolbar
