/* *
 * TagSettingEditor
 *
 */

import Link from 'next/link'
import { type FC, useEffect } from 'react'

import { COLOR } from '~/const/colors'
import { DRAWER_SCROLLER } from '~/const/dom'
import { POST_LAYOUT } from '~/const/layout'
import { MARKER } from '~/const/marker'
import { CHANGE_MODE } from '~/const/mode'
import { ROUTE } from '~/const/route'
import { DEFAULT_TAG_MARKER } from '~/const/tag'
import useTrans from '~/hooks/useTrans'
import type { TChangeMode, TColorName, TSelectOption, TTransKey } from '~/spec'
import ColorSelector from '~/widgets/ColorSelector'
import CustomScroller from '~/widgets/CustomScroller'
import Input from '~/widgets/Input'
import MarkdownEditor from '~/widgets/MarkdownEditor'
import MarkerPicker from '~/widgets/MarkerPicker'
import Select from '~/widgets/Select'

import Footer from './Footer'
import PostLayout from './PostLayout'
import useSalon, { cn } from './salon'
import useLogic from './useLogic'

type TProps = {
  mode?: TChangeMode
  initialGroup?: string
  onDone?: () => void
}

const TagSettingEditor: FC<TProps> = ({ mode = CHANGE_MODE.UPDATE, initialGroup = '', onDone }) => {
  const s = useSalon()
  const { t } = useTrans()
  const logic = useLogic({ initialGroup, onDone })
  const { initEditingTag, edit, editingTag, curCategory, categoryOptions, slugError } = logic

  useEffect(() => {
    initEditingTag(mode)
  }, [initEditingTag, mode])

  if (!editingTag) return null

  const editingMarker = editingTag.marker ?? DEFAULT_TAG_MARKER
  const markerIsEmoji = editingMarker.type === MARKER.EMOJI

  return (
    <div className={s.wrapper}>
      <CustomScroller
        instanceKey={DRAWER_SCROLLER}
        direction='vertical'
        height='calc(100vh - 112px)'
        barSize='small'
        showShadow={false}
        autoHide={false}
      >
        {mode === CHANGE_MODE.CREATE && (
          <>
            <div className='mb-6' />
            <div className={s.title}>{t('dsb.tags.editor.name')}</div>
            <div className={s.basicInfo}>
              <Input
                className={s.titleInput}
                width='w-72'
                value={editingTag.title}
                onChange={(e) => edit(e.target.value, 'title')}
              />
            </div>
          </>
        )}

        <div className='mb-6' />
        <div className={s.title}>{t('dsb.tags.editor.icon')}</div>
        <div className={s.iconSetting}>
          <div className={s.iconPicker}>
            <MarkerPicker
              compact
              value={editingMarker}
              color={markerIsEmoji ? undefined : (editingTag.color as TColorName) || COLOR.BLACK}
              iconSize={4}
              triggerClassName='size-full'
              onChange={(marker) => edit(marker, 'marker')}
            />
          </div>
          {!markerIsEmoji && (
            <ColorSelector
              activeColor={editingTag.color || COLOR.BLACK}
              onChange={(color) => edit(color, 'color')}
              placement='bottom-start'
              offset={[0, 0]}
            >
              <div className={s.dotSelector}>
                <div
                  className={cn(
                    s.titleDot,
                    s.rainbow((editingTag.color as TColorName) || COLOR.BLACK, 'bg'),
                  )}
                />
              </div>
            </ColorSelector>
          )}
        </div>

        <div className='mb-6' />
        <div className={s.title}>{t('dsb.tags.editor.group')}</div>
        <div className='mb-1' />
        <div className={s.selectorWrapper}>
          <Select
            value={curCategory}
            options={categoryOptions}
            placeholder={t('dsb.tags.editor.group.placeholder')}
            onChange={(option: TSelectOption) => edit(option.value, 'groupId')}
          />
        </div>
        <div className='mb-6' />
        <div className={s.title}>{t('dsb.tags.editor.slug')}</div>
        <div className={s.inputWrapper}>
          <Input
            className={s.slugInput}
            width='w-full'
            value={editingTag.slug}
            placeholder={t('dsb.tags.editor.slug.placeholder')}
            onChange={(e) => edit(e.target.value, 'slug')}
          />
          {slugError && <div className={s.error}>{t(slugError as TTransKey)}</div>}
        </div>
        <div className='mb-6' />
        <div className={s.title}>{t('dsb.tags.editor.desc')}</div>
        <div className={s.inputWrapper}>
          <MarkdownEditor
            className={s.markdownEditor}
            value={editingTag.desc}
            placeholder={t('dsb.tags.editor.desc.placeholder')}
            minRows={5}
            onChange={(value) => edit(value, 'desc')}
          />
        </div>
        <div className='mb-6' />
        <div className={s.title}>{t('dsb.tags.editor.layout')}</div>
        <div className={s.desc}>
          {t('dsb.tags.editor.layout.desc_prefix')}
          <Link href={`/dashboard/home/${ROUTE.DASHBOARD.APPEARANCE}`} className={s.navi}>
            {t('dsb.tags.editor.layout.link')}
          </Link>
          {t('dsb.tags.editor.layout.desc_suffix')}
        </div>
        <div className='mb-5' />
        <PostLayout
          layout={editingTag.layout || POST_LAYOUT.QUORA}
          onChange={(v) => edit(v, 'layout')}
        />
      </CustomScroller>
      <Footer logic={logic} />
    </div>
  )
}

export default TagSettingEditor
