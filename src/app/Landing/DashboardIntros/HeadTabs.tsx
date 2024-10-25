// import Button from '~/widgets/Buttons/Button'

import { DASHBOARD_ROUTE } from '~/const/route'

import type { TIntroTab } from './spec'

import useSalon, { cn } from '../styles/dashboard_intros/head_tabs'

type TProps = {
  tab: TIntroTab
  onChange: (tab: TIntroTab) => void
}

export default ({ tab, onChange }: TProps) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.LAYOUT && s.purpleActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.LAYOUT)}
      >
        布局 / 样式
      </button>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.POST && s.blueActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.POST)}
      >
        内容管理
      </button>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.SEO && s.cyanActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.SEO)}
      >
        SEO / RSS
      </button>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.TAGS && s.greenActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.TAGS)}
      >
        标签设置
      </button>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.ADMINS && s.redActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.ADMINS)}
      >
        权限管理
      </button>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.HEADER && s.brownActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.HEADER)}
      >
        页头 / 页脚
      </button>
      <button
        className={cn(s.button, tab === DASHBOARD_ROUTE.INOUT && s.yellowActive)}
        onClick={() => onChange(DASHBOARD_ROUTE.INOUT)}
      >
        导入 / 通知
      </button>
      <button className={s.button}>嵌入集成</button>
      <button className={s.button}>统计分析</button>
    </div>
  )
}
