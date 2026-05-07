import { type FC, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { COLOR } from '~/const/colors'
import { THREAD } from '~/const/thread'
import { sortByIndex } from '~/helper'
import useTrans from '~/hooks/useTrans'
import ArrowSVG from '~/icons/ArrowSimple'
import EditSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import PlusSVG from '~/icons/Plus'
import type { TColorName, TTag, TThread } from '~/spec'
import Button from '~/widgets/Buttons/Button'
import YesOrNoButtons from '~/widgets/Buttons/YesOrNoButtons'
import ColorSelector from '~/widgets/ColorSelector'
import Input from '~/widgets/Input'
import Tooltip from '~/widgets/Tooltip'

import useTags from '../logic/useTags'
import useSalon, { cn } from '../salon/tags/group_block'
import GroupActionMenu from './GroupActionMenu'
import TagBar from './TagBar'

type TProps = {
  title: string
  tags: readonly TTag[]
  draft?: boolean
  draftId?: string
  activeThread: TThread | null
  groupNames: readonly string[]
  onCreateTag: (group: string) => void
  onRemoveDraft: (draftId: string) => void
  onRenameDraft: (draftId: string, toGroup: string) => void
  onSettingTag: (tag: TTag) => void
}

const canRenameRealGroup = (thread: TThread | null): boolean => {
  return thread === THREAD.POST || thread === THREAD.CHANGELOG
}

const GroupBlock: FC<TProps> = ({
  title,
  tags,
  draft = false,
  draftId,
  activeThread,
  groupNames,
  onCreateTag: _onCreateTag,
  onRemoveDraft,
  onRenameDraft,
  onSettingTag,
}) => {
  const s = useSalon()
  const { t } = useTrans()
  const { createTag, renameGroup } = useTags()
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const beforeRects = useRef(new Map<string, DOMRect>())

  const [folded, setFolded] = useState(false)
  const [renaming, setRenaming] = useState(draft && title.trim().length === 0)
  const [nextTitle, setNextTitle] = useState(title)
  const [saving, setSaving] = useState(false)
  const [creatingFirstTag, setCreatingFirstTag] = useState(false)
  const [newTagTitle, setNewTagTitle] = useState('')
  const [newTagColor, setNewTagColor] = useState<TColorName>(COLOR.BLACK)
  const [creatingTag, setCreatingTag] = useState(false)

  const sortedTags = useMemo(() => sortByIndex(tags), [tags])
  const orderKey = sortedTags.map((tag) => tag.id || tag.slug || tag.title).join(':')
  const trimmedTitle = nextTitle.trim()
  const isDuplicate = groupNames.some((group) => group !== title && group === trimmedTitle)
  const canSave = trimmedTitle.length > 0 && !isDuplicate && (draft || trimmedTitle !== title)
  const canCreateFirstTag = newTagTitle.trim().length > 0
  const realGroupRenameEnabled = !draft && canRenameRealGroup(activeThread)

  const measureItems = (): void => {
    const rects = new Map<string, DOMRect>()

    for (const [id, node] of itemRefs.current) {
      rects.set(id, node.getBoundingClientRect())
    }

    beforeRects.current = rects
  }

  useLayoutEffect(() => {
    for (const [id, node] of itemRefs.current) {
      const previous = beforeRects.current.get(id)
      if (!previous) continue

      const next = node.getBoundingClientRect()
      const deltaX = previous.left - next.left
      const deltaY = previous.top - next.top

      if (deltaX === 0 && deltaY === 0) continue

      node.animate(
        [{ transform: `translate(${deltaX}px, ${deltaY}px)` }, { transform: 'translate(0, 0)' }],
        {
          duration: 180,
          easing: 'cubic-bezier(0.2, 0, 0, 1)',
        },
      )
    }

    beforeRects.current = new Map()
  }, [orderKey])

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
      onRenameDraft(draftId, trimmedTitle)
      setRenaming(false)
      setFolded(false)
      setCreatingFirstTag(true)
      return
    }

    setSaving(true)
    await renameGroup(title, trimmedTitle)
    setSaving(false)
    setRenaming(false)
  }

  const cancelRename = (): void => {
    setNextTitle(title)

    if (draft && draftId && tags.length === 0) {
      onRemoveDraft(draftId)
      return
    }

    setRenaming(false)
  }

  const commitFirstTag = async (): Promise<void> => {
    if (!canCreateFirstTag || !title.trim()) return

    setCreatingTag(true)
    await createTag(newTagTitle, title, newTagColor)
    setCreatingTag(false)
    setCreatingFirstTag(false)
    setNewTagTitle('')
    setNewTagColor(COLOR.BLACK)
    if (draft && draftId) onRemoveDraft(draftId)
  }

  return (
    <section className={s.wrapper}>
      <div className={s.header}>
        {renaming ? (
          <div
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
              autoFocus
              onChange={(e) => setNextTitle(e.target.value)}
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
            <div className={s.title}>{title}</div>

            <button
              type='button'
              className={s.foldButton}
              aria-label={folded ? 'Expand group' : 'Collapse group'}
              onClick={() => setFolded(!folded)}
            >
              <ArrowSVG
                className={cn(s.foldIcon, folded ? 'rotate-[180deg]' : 'rotate-[270deg]')}
              />
            </button>
            <div className='grow' />

            <div className={s.actionGroup}>
              {(draft || realGroupRenameEnabled) && (
                <button type='button' className={s.iconButton} onClick={() => setRenaming(true)}>
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
                <button type='button' className={s.iconButton} aria-label='Group actions'>
                  <MoreSVG className={s.icon} />
                </button>
              </Tooltip>
            </div>
          </>
        )}
      </div>

      {!renaming && !folded && (
        <div className={s.tags}>
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
                autoFocus
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
            <div
              key={tag.id || tag.slug || tag.title}
              className='w-full'
              ref={(node) => {
                const tagKey = tag.id || tag.slug || tag.title
                if (!tagKey) return

                if (node) itemRefs.current.set(tagKey, node)
                if (!node) itemRefs.current.delete(tagKey)
              }}
            >
              <TagBar
                tag={tag}
                isFirst={index === 0}
                isLast={index === sortedTags.length - 1}
                total={sortedTags.length}
                onSetting={onSettingTag}
                onBeforeReorder={measureItems}
                inGroup
              />
            </div>
          ))}

          {sortedTags.length === 0 && !creatingFirstTag && (
            <div className={s.empty}>
              <Button ghost noBorder size='small' onClick={() => setCreatingFirstTag(true)}>
                {t('dsb.tags.group.create_first_tag')}
              </Button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}

export default GroupBlock
