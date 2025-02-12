/* *
 * TagSettingEditor
 *
 */

import { type FC, useEffect } from 'react'
import Link from 'next/link'

import type { TChangeMode, TColorName, TSelectOption } from '~/spec'
import { ROUTE } from '~/const/route'
import { DRAWER_SCROLLER } from '~/const/dom'
import { COLOR_NAME } from '~/const/colors'
import { CHANGE_MODE } from '~/const/mode'
import { POST_LAYOUT } from '~/const/layout'

import Input from '~/widgets/Input'
import ColorSelector from '~/widgets/ColorSelector'
import Select from '~/widgets/Select'
import CustomScroller from '~/widgets/CustomScroller'

import PostLayout from './PostLayout'
import Footer from './Footer'

import useLogic from './useLogic'

import useSalon, { cn } from './salon'

type TProps = {
  mode?: TChangeMode
}

const TagSettingEditor: FC<TProps> = ({ mode = CHANGE_MODE.UPDATE }) => {
  const s = useSalon()
  const { initEditingTag, edit, editingTag, getCategory, getCategoryOptions } = useLogic()
  const curCategory = getCategory()
  const categoryOptions = getCategoryOptions()

  useEffect(() => {
    initEditingTag(mode)
  }, [initEditingTag, mode])

  return (
    <div className={s.wrapper}>
      <CustomScroller
        instanceKey={DRAWER_SCROLLER}
        direction="vertical"
        height="calc(100vh - 200px)"
        barSize="small"
        showShadow={false}
        autoHide={false}
      >
        {mode === CHANGE_MODE.CREATE && (
          <>
            <div className="mb-6" />
            <div className={s.title}>标签名称</div>
            <div className={s.basicInfo}>
              <ColorSelector
                activeColor={editingTag.color || COLOR_NAME.BLACK}
                onChange={(color) => edit(color, 'color')}
                placement="bottom-start"
                offset={[0, 0]}
              >
                <div className={s.dotSelector}>
                  <div
                    className={cn(
                      s.titleDot,
                      s.rainbow((editingTag?.color as TColorName) || COLOR_NAME.BLACK, 'bg'),
                    )}
                  />
                </div>
              </ColorSelector>

              <Input
                className={s.titleInput}
                value={editingTag?.title}
                onChange={(e) => edit(e.target.value, 'title')}
              />
            </div>
          </>
        )}

        <div className="mb-6" />
        <div className={s.title}>标签分组</div>
        <div className="mb-1" />
        <div className={s.selectorWrapper}>
          <Select
            value={curCategory}
            options={categoryOptions}
            placeholder="请选择标签所在分组"
            onCreateOption={(value) => edit(value, 'group')}
            onChange={(option: TSelectOption) => edit(option.value, 'group')}
            creatable
          />
        </div>
        <div className="mb-6" />
        <div className={s.title}>标签说明</div>
        <div className="mb-1" />
        <Input
          className={s.inputer}
          value={editingTag?.desc}
          placeholder="标签说明 (支持 Markdown 语法)"
          behavior="textarea"
          onChange={(e) => edit(e.target.value, 'desc')}
        />
        <div className="mb-6" />
        <div className={s.title}>标签布局</div>
        <div className={s.desc}>
          当选中该标签后，帖子列表将以此布局展示。所有标签默认的展示布局可在{' '}
          <Link href={`/dashboard/home/${ROUTE.DASHBOARD.LAYOUT}`} className={s.navi}>
            板块布局
          </Link>
          中设置。{' '}
        </div>
        <div className="mb-5" />
        <PostLayout
          layout={editingTag?.layout || POST_LAYOUT.QUORA}
          onChange={(v) => edit(v, 'layout')}
        />
      </CustomScroller>
      <Footer />
    </div>
  )
}

export default TagSettingEditor
