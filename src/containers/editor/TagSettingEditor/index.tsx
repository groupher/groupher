/* *
 * TagSettingEditor
 *
 */

import { type FC, useEffect } from 'react'

import type { TChangeMode, TColorName, TSelectOption } from '~/spec'
import { ROUTE } from '~/const/route'
import { DRAWER_SCROLLER } from '~/const/dom'
import { COLOR_NAME } from '~/const/colors'
import { CHANGE_MODE } from '~/const/mode'
import { POST_LAYOUT } from '~/const/layout'

import ColorSelector from '~/widgets/ColorSelector'

import { Br } from '~/widgets/Common'
import Select from '~/widgets/Select'
import CustomScroller from '~/widgets/CustomScroller'

import PostLayout from './PostLayout'
import Footer from './Footer'

import useLogic from './useLogic'

import {
  Wrapper,
  BasicInfo,
  DotSelector,
  TitleDot,
  SelectorWrapper,
  Title,
  Desc,
  Navi,
  TitleInputer,
  Inputer,
} from './styles'

type TProps = {
  mode?: TChangeMode
}

const TagSettingEditor: FC<TProps> = ({ mode = CHANGE_MODE.UPDATE }) => {
  const { initEditingTag, edit, editingTag, getCategory, getCategoryOptions } = useLogic()
  const curCategory = getCategory()
  const categoryOptions = getCategoryOptions()

  useEffect(() => {
    initEditingTag(mode)
  }, [initEditingTag, mode])

  return (
    <Wrapper $testid="tag-setting-editor">
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
            <Br bottom={25} />
            <Title>标签名称</Title>
            <BasicInfo>
              <ColorSelector
                activeColor={editingTag.color || COLOR_NAME.BLACK}
                onChange={(color) => edit(color, 'color')}
                placement="bottom-start"
                offset={[0, 0]}
              >
                <DotSelector>
                  <TitleDot color={(editingTag?.color as TColorName) || COLOR_NAME.BLACK} />
                </DotSelector>
              </ColorSelector>

              <TitleInputer
                value={editingTag?.title}
                onChange={(e) => edit(e.target.value, 'title')}
              />
            </BasicInfo>
          </>
        )}

        <Br bottom={25} />
        <Title>标签分组</Title>
        <Br bottom={5} />
        <SelectorWrapper>
          <Select
            value={curCategory}
            options={categoryOptions}
            placeholder="请选择标签所在分组"
            onCreateOption={(value) => edit(value, 'group')}
            onChange={(option: TSelectOption) => edit(option.value, 'group')}
            creatable
          />
        </SelectorWrapper>
        <Br bottom={25} />
        <Title>标签说明</Title>
        <Br bottom={5} />
        <Inputer
          value={editingTag?.desc}
          placeholder="标签说明 (支持 Markdown 语法)"
          behavior="textarea"
          onChange={(e) => edit(e.target.value, 'desc')}
        />
        <Br bottom={25} />
        <Title>标签布局</Title>
        <Desc>
          当选中该标签后，帖子列表将以此布局展示。所有标签默认的展示布局可在{' '}
          <Navi href={`/dashboard/home/${ROUTE.DASHBOARD.LAYOUT}`}>板块布局</Navi>
          中设置。{' '}
        </Desc>
        <Br bottom={20} />
        <PostLayout
          layout={editingTag?.layout || POST_LAYOUT.QUORA}
          onChange={(v) => edit(v, 'layout')}
        />
      </CustomScroller>
      <Footer />
    </Wrapper>
  )
}

export default TagSettingEditor
