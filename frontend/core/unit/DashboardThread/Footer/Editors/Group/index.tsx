import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import useDashboard from '~/stores/dashboard/hooks'
import { FIELD } from '~/unit/DashboardThread/constant'
import Button from '~/widgets/Buttons/Button'

import LinkEditor from '../../../LinkEditor'
import SortableColumn from '../../../LinkEditor/Dnd/SortableColumn'
import GroupDragHandle from '../../../LinkEditor/GroupDragHandle'
import GroupHead from '../../../LinkEditor/GroupHead'
import GroupInputer from '../../../LinkEditor/GroupInputer'
import LinksHint from '../../../LinkEditor/LinksHint'
import useFooter from '../../../logic/useFooter'
import useSalon from '../../../salon/footer/editors/group'
import { FOOTER_DND_TYPE } from '../constants'
import FooterDndContext from '../FooterDndContext'
import FooterSortableGroup from '../FooterSortableGroup'
import { toDraftLink } from '../model'
import SortableFooterLinkItem from '../SortableFooterLinkItem'
import useFooterEditorActions from '../useFooterEditorActions'

const Group: FC = () => {
  const s = useSalon()
  const { t } = useTrans()

  const { footerLinks: links } = useFooter()
  const editor = useFooterEditorActions(links)
  const dsb$ = useDashboard()

  return (
    <div className={s.wrapper}>
      <div className={s.actionRow}>
        {editor.editingGroup !== null && editor.editingGroupIndex === null ? (
          <GroupInputer
            value={editor.editingGroup}
            onChange={editor.updateEditingGroup}
            onConfirm={editor.confirmGroupAdd}
            onCancel={editor.cancelGroupChange}
          />
        ) : (
          <Button
            size='small'
            ghost
            noBorder
            space={1.5}
            left={-1}
            onClick={editor.triggerGroupAdd}
          >
            <PlusSVG className={s.plusIcon} />
            {t('dsb.footer.editors.group')}
          </Button>
        )}
      </div>

      <FooterDndContext
        links={links}
        onCommit={(nextLinks) => dsb$.editField(FIELD.FOOTER_LINKS, nextLinks)}
        enableColumnSorting
      >
        {({ activeDragColumnId, columns, targetDragColumnId }) => (
          <div className={s.linkGroup}>
            <SortableContext
              items={columns.map((column) => `footer-sortable-column:${column.id}`)}
              strategy={rectSortingStrategy}
            >
              {columns.map((column) => {
                const isCollapsed = editor.collapsedGroups.has(column.id)
                const isEmptyGroup = column.links.length === 0
                const isCrossGroupTarget =
                  !!activeDragColumnId &&
                  !!targetDragColumnId &&
                  targetDragColumnId === column.id &&
                  activeDragColumnId !== column.id

                return (
                  <SortableColumn
                    className={s.column}
                    key={column.id}
                    columnId={column.id}
                    dndType={{
                      link: FOOTER_DND_TYPE.LINK,
                      column: FOOTER_DND_TYPE.COLUMN,
                      sortableColumn: FOOTER_DND_TYPE.SORTABLE_COLUMN,
                    }}
                    idPrefix='footer-sortable-column'
                  >
                    {({ attributes, listeners, setActivatorNodeRef }) => (
                      <>
                        <FooterSortableGroup
                          className={s.items}
                          overClassName={s.itemsOver}
                          targetClassName={isCrossGroupTarget ? s.itemsTarget : ''}
                          columnId={column.id}
                          ids={column.links.map((item) => item.dndId)}
                        >
                          <GroupHead
                            title={column.title}
                            currentIndex={column.sourceIndex}
                            dragHandle={
                              <GroupDragHandle
                                attributes={attributes}
                                label='Drag footer group'
                                listeners={listeners}
                                setActivatorNodeRef={setActivatorNodeRef}
                              />
                            }
                            collapsed={isCollapsed}
                            onToggle={() => editor.toggleGroup(column.id)}
                            onEdit={editor.triggerGroupUpdate}
                            onDelete={() => editor.deleteGroup(column.sourceIndex)}
                            editingGroup={editor.editingGroup}
                            editingGroupIndex={editor.editingGroupIndex}
                            onCancelEdit={editor.cancelGroupChange}
                            onChangeEdit={editor.updateEditingGroup}
                            onConfirmEdit={editor.confirmGroupUpdate}
                          />
                          {isEmptyGroup ? (
                            <LinksHint count={0} empty />
                          ) : isCollapsed ? (
                            <LinksHint count={column.links.length} />
                          ) : (
                            column.links.map((item, itemIndex) => {
                              const linkItem = toDraftLink(
                                item,
                                column.id,
                                column.sourceIndex,
                                itemIndex,
                              )

                              return (
                                <SortableFooterLinkItem
                                  key={item.dndId}
                                  id={item.dndId}
                                  columnId={column.id}
                                  editing={
                                    linkItem.group === editor.editingLink?.group &&
                                    linkItem.index === editor.editingLink?.index
                                  }
                                >
                                  <LinkEditor
                                    mode={editor.editingLinkMode}
                                    linkItem={linkItem}
                                    editingLink={editor.editingLink}
                                    actions={editor.linkActions}
                                  />
                                </SortableFooterLinkItem>
                              )
                            })
                          )}
                        </FooterSortableGroup>

                        {!editor.editingLink && !isCollapsed && (
                          <Button
                            onClick={() => editor.add2Group(column.id, column.sourceIndex)}
                            size='small'
                            ghost
                            noBorder
                            space={1}
                            left={0.5}
                          >
                            <PlusSVG className={s.plusIcon} />
                            {t('dsb.footer.editors.link')}
                          </Button>
                        )}
                      </>
                    )}
                  </SortableColumn>
                )
              })}
            </SortableContext>
          </div>
        )}
      </FooterDndContext>
    </div>
  )
}

export default Group
