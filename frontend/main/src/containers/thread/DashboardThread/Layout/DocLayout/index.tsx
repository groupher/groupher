import { DOC_LAYOUT, DOC_FAQ_LAYOUT, DASHBOARD_DESC_LAYOUT } from '~/const/layout'
import { callDashboardDesc } from '~/signal'

import ArrowButton from '~/widgets/Buttons/ArrowButton'
import CheckLabel from '~/widgets/CheckLabel'

import { SETTING_FIELD } from '../../constant'
import SectionLabel from '../../SectionLabel'
import SavingBar from '../../SavingBar'

import MainTemplate from './MainTemplate'
import FaqTemplate from './FaqTemplate'

import useDoc from '../../logic/useDoc'
import useSalon, { cn } from '../../salon/layout/doc_layout'

export default () => {
  const s = useSalon()

  const { docLayout, docFaqLayout, getIsTouched, getIsFaqTouched, saving, edit } = useDoc()
  const isTouched = getIsTouched()
  const isFaqTouched = getIsFaqTouched()

  return (
    <div className={s.wrapper}>
      <SectionLabel
        title="封面目录布局"
        desc={
          <div className="inline-flex">
            全部文档的目录布局。
            <ArrowButton
              onClick={() => callDashboardDesc(DASHBOARD_DESC_LAYOUT.POST_LIST)}
              fontSize={12}
            >
              查看示例
            </ArrowButton>
          </div>
        }
      />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(DOC_LAYOUT.BLOCKS, 'docLayout')}>
          <div className={cn(s.block, docLayout === DOC_LAYOUT.BLOCKS && s.blockActive)}>
            <MainTemplate layout={DOC_LAYOUT.BLOCKS} />
          </div>
          <CheckLabel title="块状排列" active={docLayout === DOC_LAYOUT.BLOCKS} top={4} />
        </div>

        <div className={s.layout} onClick={() => edit(DOC_LAYOUT.LISTS, 'docLayout')}>
          <div className={cn(s.block, docLayout === DOC_LAYOUT.LISTS && s.blockActive)}>
            <MainTemplate layout={DOC_LAYOUT.LISTS} />
          </div>
          <CheckLabel title="列表排列" active={docLayout === DOC_LAYOUT.LISTS} top={4} />
        </div>

        <div className={s.layout} onClick={() => edit(DOC_LAYOUT.CARDS, 'docLayout')}>
          <div
            className={cn(
              s.block,
              'py-2 pl-2.5 pr-0',
              docLayout === DOC_LAYOUT.CARDS && s.blockActive,
            )}
          >
            <MainTemplate layout={DOC_LAYOUT.CARDS} />
          </div>
          <CheckLabel title="卡片排列" active={docLayout === DOC_LAYOUT.CARDS} top={4} />
        </div>
      </div>
      <SavingBar
        isTouched={isTouched}
        field={SETTING_FIELD.DOC_LAYOUT}
        loading={saving}
        width="w-11/12"
        top={10}
      />

      <div className={s.divider} />

      <SectionLabel
        title="常见问题（FAQ）布局"
        desc={
          <div className="inline-flex">
            当前设置仅针对常见问题的展示样式。
            <ArrowButton
              onClick={() => callDashboardDesc(DASHBOARD_DESC_LAYOUT.POST_LIST)}
              fontSize={12}
            >
              查看示例
            </ArrowButton>
          </div>
        }
      />
      <div className={s.select}>
        <div className={s.layout} onClick={() => edit(DOC_FAQ_LAYOUT.COLLAPSE, 'docFaqLayout')}>
          <div className={cn(s.block, docFaqLayout === DOC_FAQ_LAYOUT.COLLAPSE && s.blockActive)}>
            <FaqTemplate layout={DOC_FAQ_LAYOUT.COLLAPSE} />
          </div>
          <CheckLabel title="可折叠" active={docFaqLayout === DOC_FAQ_LAYOUT.COLLAPSE} top={4} />
        </div>
        <div className={s.layout} onClick={() => edit(DOC_FAQ_LAYOUT.FLAT, 'docFaqLayout')}>
          <div className={cn(s.block, docFaqLayout === DOC_FAQ_LAYOUT.FLAT && s.blockActive)}>
            <FaqTemplate layout={DOC_FAQ_LAYOUT.FLAT} />
          </div>
          <CheckLabel title="铺开式" active={docFaqLayout === DOC_FAQ_LAYOUT.FLAT} top={4} />
        </div>
      </div>
      <SavingBar
        isTouched={isFaqTouched}
        field={SETTING_FIELD.DOC_FAQ_LAYOUT}
        loading={saving}
        width="w-11/12"
        top={10}
      />
    </div>
  )
}
