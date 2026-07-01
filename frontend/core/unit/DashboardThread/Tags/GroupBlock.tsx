import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { memo, type FC, useCallback, useMemo, useRef, useState } from 'react'

import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import GrabDotsSVG from '~/icons/GrabDots'
import MoreSVG from '~/icons/menu/MoreL'
import PlusSVG from '~/icons/Plus'
import type { TColorName, TTag, TThread } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import YesOrNoButtons from '~/widgets/Buttons/YesOrNoButtons'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import { toast } from '~/widgets/Toaster'
import Tooltip from '~/widgets/Tooltip'

import useTags from '../logic/useTags'
import GroupActionMenu from './GroupActionMenu'
import useSalon, { cn } from './salon/group_block'
import SortableTagItem from './SortableTagItem'
import TagSortableGroup from './TagSortableGroup'

const clampTranslateX = (x: number): number => Math.max(-12, Math.min(36, x))

type TProps = {
  title: string
  groupId: string
  tags: readonly TTag[]
  draft?: boolean
  draftId?: string
  activeThread: TThread | null
  groupNames: readonly string[]
  onRemoveDraft: (draftId: string) => void
  onRenameDraft: (draftId: string, toGroup: string) => void
  onCompleteDraft: (draftId?: string) => void
  onSettingTag: (tag: TTag) => void
}

const canRenameRealGroup = (thread: TThread | null): boolean => {
  return thread === THREAD.POST || thread === THREAD.CHANGELOG
}

const GroupBlock: FC<TProps> = ({
  title,
  groupId,
  tags,
  draft = false,
  draftId,
  activeThread,
  groupNames,
  onRemoveDraft,
  onRenameDraft,
  onCompleteDraft,
  onSettingTag,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const { createGroup, createTag, renameGroup } = useTags()
  const listRef = useRef<HTMLDivElement | null>(null)
  const getListRect = useCallback(() => listRef.current?.getBoundingClientRect(), [])

  const [folded, setFolded] = useState(false)
  const [renaming, setRenaming] = useState(draft && title.trim().length === 0)
  const [nextTitleDraft, setNextTitleDraft] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [creatingFirstTag, setCreatingFirstTag] = useState(false)
  const [newTagTitle, setNewTagTitle] = useState('')
  const [newTagColor, setNewTagColor] = useState<TColorName>(COLOR.BLACK)
  const [creatingTag, setCreatingTag] = useState(false)

  const sortedTags = useMemo(() => sortByIndex(tags), [tags])
  const nextTitle = nextTitleDraft ?? title
  const trimmedTitle = nextTitle.trim()
  const isDuplicate = groupNames.some((group) => group !== title && group === trimmedTitle)
  const canSave = trimmedTitle.length > 0 && !isDuplicate && (draft || trimmedTitle !== title)
  const canCreateFirstTag = newTagTitle.trim().length > 0
  const realGroupRenameEnabled = !draft && canRenameRealGroup(activeThread)
  const sortableIds = useMemo(
    () => sortedTags.flatMap((tag) => (tag.id ? [tag.id] : [])),
    [sortedTags],
  )
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `tag-group-sort:${groupId}`,
    disabled: draft || renaming,
    data: {
      type: 'group',
      groupId,
      getRect: () => listRef.current?.parentElement?.getBoundingClientRect(),
    },
  })

  const style = {
    transform: transform
      ? CSS.Transform.toString({
          ...transform,
          x: clampTranslateX(transform.x),
          scaleX: 1,
          scaleY: 1,
        })
      : undefined,
    transition,
  }

  const commitRename = async (): Promise<void> => {
    if (!trimmedTitle) {
      if (draft && draftId && tags.length === 0) onRemoveDraft(draftId)
      return
    }

    if (isDuplicate) return

    if (trimmedTitle === title) {
      setRenaming(false)
      return
    }

    if (draft) {
      if (!draftId) return
      setSaving(true)
      try {
        onRenameDraft(draftId, trimmedTitle)
        await createGroup(trimmedTitle)
        onCompleteDraft(draftId)
      } finally {
        setSaving(false)
      }
      return
    }

    setSaving(true)
    try {
      await renameGroup(groupId, trimmedTitle)
      setNextTitleDraft(trimmedTitle)
      setRenaming(false)
    } catch (err) {
      toast(String(err), 'error')
      // Keep the editor open so the user can retry without losing the input.
    } finally {
      setSaving(false)
    }
  }

  const cancelRename = (): void => {
    setNextTitleDraft(null)

    if (draft && draftId && tags.length === 0) {
      onRemoveDraft(draftId)
      return
    }

    setRenaming(false)
  }

  const commitFirstTag = async (): Promise<void> => {
    if (!canCreateFirstTag || !title.trim()) return

    setCreatingTag(true)
    try {
      await createTag(newTagTitle, groupId, newTagColor)
      setCreatingFirstTag(false)
      setNewTagTitle('')
      setNewTagColor(COLOR.BLACK)
      if (draft) onCompleteDraft(draftId)
    } catch {
      // Keep the inline creator open so the user can retry without retyping.
    } finally {
      setCreatingTag(false)
    }
  }

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={cn(s.wrapper, isDragging && s.groupDragging)}
    >
      <div className={s.header}>
        {renaming ? (
          <div
            role='group'
            className={s.editBox}
            onKeyDown={(e) => {
              if (e.key === 'Escape') cancelRename()
            }}
          >
            <Input
              className={s.groupInput}
              width='w-48'
              value={nextTitle}
              placeholder={t('dsb.tags.group.new')}
              focusOnMount
              onChange={(e) => setNextTitleDraft(e.target.value)}
              onEnter={commitRename}
            />
            {isDuplicate && <div className={s.error}>{t('dsb.tags.group.error.duplicate')}</div>}
            <div className='grow' />
            <YesOrNoButtons
              cancelText={t('dsb.saving_bar.cancel')}
              saveText={t('dsb.saving_bar.save')}
              loading={saving}
              disabled={!canSave}
              space={!saving ? 1.5 : 0}
              onCancel={cancelRename}
              onConfirm={() => void commitRename()}
            />
          </div>
        ) : (
          <>
            {!draft && (
              <button
                ref={setActivatorNodeRef}
                type='button'
                className={s.groupDragHandle}
                aria-label={t('dsb.aria.drag_group')}
                {...attributes}
                {...listeners}
              >
                <GrabDotsSVG className='size-4' />
              </button>
            )}
            <div className={s.title}>{title}</div>

            <button
              type='button'
              className={s.foldButton}
              aria-label={folded ? t('dsb.aria.expand_group') : t('dsb.aria.collapse_group')}
              onClick={() => setFolded(!folded)}
            >
              <ArrowSVG className={cn(s.foldIcon, folded ? 'rotate-180' : '-rotate-90')} />
            </button>
            <div className='grow' />

            <div className={s.actionGroup}>
              {(draft || realGroupRenameEnabled) && (
                <button
                  type='button'
                  className={s.editIconButton}
                  onClick={() => {
                    setNextTitleDraft(title)
                    setRenaming(true)
                  }}
                >
                  <EditSVG className={s.icon} />
                </button>
              )}

              <button
                type='button'
                className={s.iconButton}
                onClick={() => {
                  setFolded(false)
                  setCreatingFirstTag(true)
                }}
              >
                <PlusSVG className={s.icon} />
              </button>

              <Tooltip
                content={<GroupActionMenu />}
                placement='bottom-end'
                trigger='click'
                offset={[4, 0]}
                delay={300}
                hideOnClick
                noPadding
              >
                <button
                  type='button'
                  className={s.iconButton}
                  aria-label={t('dsb.aria.group_actions')}
                >
                  <MoreSVG className={s.icon} />
                </button>
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {!renaming && !folded && (
        <TagSortableGroup
          className={s.tags}
          overClassName={s.tagsOver}
          groupId={groupId}
          ids={sortableIds}
          listRef={listRef}
        >
          {creatingFirstTag && (
            <div className={s.firstTagEdit}>
              <ColorSelector
                activeColor={newTagColor}
                onChange={(color) => setNewTagColor(color)}
                placement='bottom-start'
                offset={[-8, 0]}
              >
                <div className={s.dotSelector}>
                  <div className={cn(s.dot, s.rainbow(newTagColor, 'bg'))} />
                </div>
              </ColorSelector>
              <Input
                className={s.tagInput}
                width='w-48'
                value={newTagTitle}
                placeholder={t('dsb.tags.tag.new')}
                focusOnMount
                onChange={(e) => setNewTagTitle(e.target.value)}
                onEnter={() => void commitFirstTag()}
              />
              <div className='grow' />
              <YesOrNoButtons
                cancelText={t('dsb.saving_bar.cancel')}
                saveText={t('dsb.saving_bar.save')}
                loading={creatingTag}
                disabled={!canCreateFirstTag}
                space={!creatingTag ? 1.5 : 0}
                onCancel={() => {
                  setCreatingFirstTag(false)
                  setNewTagTitle('')
                  setNewTagColor(COLOR.BLACK)
                }}
                onConfirm={() => void commitFirstTag()}
              />
            </div>
          )}

          {sortedTags.map((tag, index) => (
            <SortableTagItem
              key={tag.id || tag.slug || tag.title}
              tag={tag}
              groupId={groupId}
              getListRect={getListRect}
              handleClassName={s.dragHandle}
              itemClassName={s.sortableTag}
              itemDraggingClassName={s.sortableTagDragging}
              isFirst={index === 0}
              isLast={index === sortedTags.length - 1}
              total={sortedTags.length}
              onSetting={onSettingTag}
            />
          ))}

          {sortedTags.length === 0 && !creatingFirstTag && (
            <div className={s.empty}>
              <Button ghost noBorder size='small' onClick={() => setCreatingFirstTag(true)}>
                {t('dsb.tags.group.create_first_tag')}
              </Button>
            </div>
          )}
        </TagSortableGroup>
      )}
    </section>
  )
}

export default memo(GroupBlock)
