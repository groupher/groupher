import type { FC } from 'react'

import { MORE_TAB } from '~/hooks/useHeaderLinks/constant'
import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import Button from '~/widgets/Buttons/Button'

import LinkEditor from '../../LinkEditor'
import GroupHead from '../../LinkEditor/GroupHead'
import LinksHint from '../../LinkEditor/LinksHint'
import useSalon from '../../salon/header/editors'
import { HEADER_COLUMN_KIND } from './constants'
import HeaderSortableGroup from './HeaderSortableGroup'
import { toLinkItem } from './model'
import SortableHeaderLinkItem from './SortableHeaderLinkItem'
import type { THeaderColumn } from './spec'
import type { THeaderEditorActions } from './useHeaderEditorActions'

type TProps = {
  column: THeaderColumn
  editor: THeaderEditorActions
  isCollapsed: boolean
  isCrossGroupTarget: boolean
}

const HeaderColumn: FC<TProps> = ({ column, editor, isCollapsed, isCrossGroupTarget }) => {
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
    toggleGroup,
    triggerGroupUpdate,
    updateEditingGroup,
  } = editor

  const isSingleLink = column.kind === HEADER_COLUMN_KIND.LINK
  const isMore = column.kind === HEADER_COLUMN_KIND.MORE
  const title = isMore ? t(MORE_TAB.TITLE_KEY) : column.title
  const isCollapsible =
    column.kind === HEADER_COLUMN_KIND.GROUP || column.kind === HEADER_COLUMN_KIND.MORE
  const isEmptyGroup = !isSingleLink && column.links.length === 0 && column.fixedLinks.length === 0
  const sortableIds = column.links.map((link) => link.id)
  const visibleLinks = [
    ...column.links.map((link, index) => ({
      link,
      index,
      sortable: true,
      sortableId: link.id,
    })),
    ...column.fixedLinks.map((link, index) => ({
      link,
      index: column.links.length + index,
      sortable: false,
      sortableId: `system-header-link:${column.id}:${link.id}`,
    })),
  ]

  return (
    <div className={s.columnWrapper}>
      <GroupHead
        title={title}
        currentIndex={column.sourceIndex}
        collapsed={isCollapsed}
        onToggle={isCollapsible ? () => toggleGroup(column.id) : undefined}
        onEdit={column.kind === HEADER_COLUMN_KIND.GROUP ? triggerGroupUpdate : undefined}
        onDelete={!isMore ? () => deleteGroup(column.sourceIndex) : undefined}
        editingGroup={editingGroup}
        editingGroupIndex={editingGroupIndex}
        onCancelEdit={cancelGroupChange}
        onChangeEdit={updateEditingGroup}
        onConfirmEdit={confirmGroupUpdate}
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
          <LinksHint count={0} empty />
        ) : isCollapsed ? (
          <LinksHint count={visibleLinks.length} />
        ) : (
          visibleLinks.map(({ link, index, sortable, sortableId }) => {
            const fixedTitle =
              link.id === MORE_TAB.ABOUT_ID
                ? t(MORE_TAB.ABOUT_TITLE_KEY)
                : link.id === MORE_TAB.DASHBOARD_ID
                  ? t(MORE_TAB.DASHBOARD_TITLE_KEY)
                  : link.title
            const linkItem = toLinkItem(
              { ...link, title: fixedTitle },
              column.id,
              column.sourceIndex,
              index,
            )
            const isEditing =
              linkItem.group === editingLink?.group && linkItem.index === editingLink?.index

            return (
              <SortableHeaderLinkItem
                key={sortableId}
                id={sortableId}
                linkId={link.id}
                columnId={column.id}
                disabled={!sortable}
                editing={isEditing}
              >
                <LinkEditor
                  linkItem={linkItem}
                  editingLink={editingLink}
                  mode={editingLinkMode}
                  disableSetting={!sortable || isSingleLink}
                  disableEdit={!sortable}
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
              left={1.5}
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
