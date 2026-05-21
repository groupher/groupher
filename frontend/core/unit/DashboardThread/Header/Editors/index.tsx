import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable'
import type { Dispatch, FC, SetStateAction } from 'react'

import useTrans from '~/hooks/useTrans'
import PlusSVG from '~/icons/Plus'
import type { TLinkItem } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import Button from '~/widgets/Buttons/Button'

import SortableDndContext from '../../LinkEditor/Dnd/SortableDndContext'
import GroupInputer from '../../LinkEditor/GroupInputer'
import useSalon from '../salon/editors'
import {
  HEADER_COLUMN_KIND,
  HEADER_DND_CONTEXT_ID,
  HEADER_DND_TYPE,
  DND_ANNOUNCEMENTS,
  DND_MEASURING,
} from './constants'
import FixedLinks from './FixedLinks'
import HeaderColumn from './HeaderColumn'
import useHeaderEditorActions from './useHeaderEditorActions'
import useHeaderLinkDnd from './useHeaderLinkDnd'

type TProps = {
  links: readonly TLinkItem[]
  onChange: Dispatch<SetStateAction<readonly TLinkItem[]>>
  makeId: (prefix: string) => string
}

const Editor: FC<TProps> = ({ links, makeId, onChange }) => {
  const s = useSalon()
  const { t } = useTrans()
  const { slug } = useCommunity()
  const editor = useHeaderEditorActions({ links, makeId, onChange })
  const dndController = useHeaderLinkDnd({
    links,
    community: slug,
    onCommit: onChange,
  })

  const isAboutLinkFold = links.length > 0

  return (
    <div className={s.wrapper}>
      <div className={s.topWrapper}>
        <div className={s.leftPart}>
          <FixedLinks isAboutLinkFold={isAboutLinkFold} />
        </div>
        <ul className={s.rightPart}>
          <h3 className={s.noteTitle}>{t('dsb.header.editors.note.title')}</h3>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.fixed')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.about')}</li>
          <li className={s.noteP}>{t('dsb.header.editors.note.item.preview')}</li>
        </ul>
      </div>

      <div className={s.divider} />

      <div className={s.adder}>
        <Button size='small' onClick={editor.triggerLinkAdd} space={0.5} ghost noBorder>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.header.editors.link')}
        </Button>
        <div className={s.slash}>/</div>
        <Button size='small' onClick={editor.triggerGroupAdd} space={0.5} ghost noBorder>
          <PlusSVG className={s.plusIcon} />
          {t('dsb.header.editors.group')}
        </Button>
      </div>

      {editor.editingGroup !== null && editor.editingGroupIndex === null && (
        <div className={s.groupInputer}>
          <GroupInputer
            value={editor.editingGroup}
            onChange={editor.updateEditingGroup}
            onConfirm={editor.saveGroup}
            onCancel={editor.cancelGroupChange}
          />
        </div>
      )}

      <SortableDndContext
        contextId={HEADER_DND_CONTEXT_ID}
        controller={dndController}
        dndType={{
          link: HEADER_DND_TYPE.LINK,
          column: HEADER_DND_TYPE.COLUMN,
          sortableColumn: HEADER_DND_TYPE.SORTABLE_COLUMN,
        }}
        announcements={DND_ANNOUNCEMENTS}
        measuring={DND_MEASURING}
      >
        {({ activeDragColumnId, columns, targetDragColumnId }) => (
          <div className={s.linkGroup}>
            <SortableContext
              items={columns.flatMap((column) =>
                column.kind === HEADER_COLUMN_KIND.MORE
                  ? []
                  : [`header-sortable-column:${column.id}`],
              )}
              strategy={rectSortingStrategy}
            >
              {columns.map((column) => {
                const isCrossGroupTarget =
                  !!activeDragColumnId &&
                  !!targetDragColumnId &&
                  targetDragColumnId === column.id &&
                  activeDragColumnId !== column.id

                return (
                  <HeaderColumn
                    key={column.id}
                    column={column}
                    editor={editor}
                    isCollapsed={editor.collapsedGroups.has(column.id)}
                    isCrossGroupTarget={isCrossGroupTarget}
                  />
                )
              })}
            </SortableContext>
          </div>
        )}
      </SortableDndContext>
    </div>
  )
}

export default Editor
