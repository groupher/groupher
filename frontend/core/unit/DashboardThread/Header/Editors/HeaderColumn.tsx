import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import Button from '~/widgets/Buttons/Button'

import LinkEditor from '../../Footer/Editors/LinkEditor'
import useSalon from '../../salon/header/editors'
import { HEADER_COLUMN_KIND } from './constants'
import GroupHead from './GroupHead'
import HeaderSortableGroup from './HeaderSortableGroup'
import { toLinkItem } from './model'
import SortableHeaderLinkItem from './SortableHeaderLinkItem'
import type { THeaderColumn } from './spec'
import type { THeaderEditorActions } from './useHeaderEditorActions'

type TProps = {
  column: THeaderColumn
  customLinksLength: number
  editor: THeaderEditorActions
  isCollapsed: boolean
  isCrossGroupTarget: boolean
}

const linkCountLabel = (count: number, t: ReturnType<typeof useTrans>['t']): string =>
  `${count} ${t(
    count === 1 ? 'dsb.header.editors.link_count.one' : 'dsb.header.editors.link_count.other',
  )}`

const HeaderColumn: FC<TProps> = ({
  column,
  customLinksLength,
  editor,
  isCollapsed,
  isCrossGroupTarget,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const {
    add2Group,
    cancelGroupChange,
    confirmGroupUpdate,
    deleteGroup,
    editingGroup,
    editingGroupIndex,
    editingLink,
    editingLinkMode,
    linkActions,
    moveGroup,
    toggleGroup,
    triggerGroupUpdate,
    updateEditingGroup,
  } = editor
  const isSingleLink = column.kind === HEADER_COLUMN_KIND.LINK
  const isMore = column.kind === HEADER_COLUMN_KIND.MORE
  const isLastCustom = column.sourceIndex === customLinksLength - 1
  const isCollapsible =
    column.kind === HEADER_COLUMN_KIND.GROUP || column.kind === HEADER_COLUMN_KIND.MORE
  const isEmptyGroup = !isSingleLink && column.links.length === 0 && column.systemLinks.length === 0
  const sortableIds = column.links.map((link) => link.id)
  const visibleLinks = [
    ...column.links.map((link, index) => ({
      link,
      index,
      sortable: true,
      sortableId: link.id,
    })),
    ...column.systemLinks.map((link, index) => ({
      link,
      index: column.links.length + index,
      sortable: false,
      sortableId: `system-header-link:${column.id}:${link.id}`,
    })),
  ]

  return (
    <div className={s.columnWrapper}>
      <GroupHead
        title={column.title}
        kind={isSingleLink ? 'link' : isMore ? 'system' : 'group'}
        curGroupIndex={column.sourceIndex}
        isEdgeLeft={column.sourceIndex === 0}
        isEdgeRight={isLastCustom}
        moveLeft={() => moveGroup(column.sourceIndex, 'up')}
        moveRight={() => moveGroup(column.sourceIndex, 'down')}
        moveEdgeLeft={() => moveGroup(column.sourceIndex, 'top')}
        moveEdgeRight={() => moveGroup(column.sourceIndex, 'bottom')}
        onDelete={() => deleteGroup(column.sourceIndex)}
        collapsed={isCollapsed}
        onToggle={isCollapsible ? () => toggleGroup(column.id) : undefined}
        editingGroup={editingGroup}
        editingGroupIndex={editingGroupIndex}
        triggerGroupUpdate={triggerGroupUpdate}
        cancelGroupChange={cancelGroupChange}
        updateEditingGroup={updateEditingGroup}
        confirmGroupUpdate={confirmGroupUpdate}
      />

      <HeaderSortableGroup
        className={s.itemsWrapper}
        overClassName={s.itemsWrapperOver}
        targetClassName={isCrossGroupTarget ? s.itemsWrapperTarget : ''}
        columnId={column.id}
        ids={sortableIds}
        disabled={isSingleLink || isCollapsed}
      >
        {isEmptyGroup ? (
          <div className={s.noLinks}>{t('dsb.header.editors.no_links_in_group')}</div>
        ) : isCollapsed ? (
          <div className={s.linksCount}>{linkCountLabel(visibleLinks.length, t)}</div>
        ) : (
          visibleLinks.map(({ link, index, sortable, sortableId }) => {
            const linkItem = toLinkItem(link, column.id, column.sourceIndex, index)

            return (
              <SortableHeaderLinkItem
                key={sortableId}
                id={sortableId}
                linkId={link.id}
                columnId={column.id}
                disabled={!sortable}
              >
                <LinkEditor
                  linkItem={linkItem}
                  editingLink={editingLink}
                  mode={editingLinkMode}
                  isFirst={isSingleLink || index === 0}
                  isLast={isSingleLink || index === visibleLinks.length - 1}
                  disableSetting={!sortable || isSingleLink}
                  disableEdit={!sortable}
                  disableMove
                  compact
                  actions={linkActions}
                />
              </SortableHeaderLinkItem>
            )
          })
        )}

        {!isMore && !isSingleLink && !isCollapsed && (
          <div className={s.addLinkRow}>
            <Button
              size='small'
              onClick={() => add2Group(column.id, column.sourceIndex)}
              space={2}
              ghost
              noBorder
              left={-1.5}
            >
              <PlusSVG className={s.plusIcon} />
              {t('dsb.header.editors.link')}
            </Button>
          </div>
        )}
      </HeaderSortableGroup>
    </div>
  )
}

export default HeaderColumn
