import type { FC } from 'react'

import CheckSVG from '~/icons/Check'
import ArrowLinker from '~/widgets/ArrowLinker'

import type { TStep } from '../../spec'
import { STEP } from '../../constant'

import useSalon, { cn } from '../../salon/content/fake_browser/mask_panel'

type TProps = {
  step: TStep
}

const MaskPanel: FC<TProps> = ({ step }) => {
  const s = useSalon()

  if (step === STEP.SETUP_DOMAIN) {
    return (
      <div className={s.wrapper}>
        <div className={s.item}>
          <div className={s.dot} />
          域名对 SEO 有影响，请确保其和你的官方产品 / 服务相关联。
        </div>
        <div className={s.item}>
          <div className={s.dot} />
          创建后域名不可随意修改。
        </div>
        <div className={s.item}>
          <div className={s.dot} />
          如果你的产品 / 服务域名已被占用，请在
          <ArrowLinker href="/feedback" left={1}>
            这里反馈
          </ArrowLinker>
          。
        </div>
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <ArrowLinker href="/" left={0}>
          自带丰富功能，查看完整特性
        </ArrowLinker>
        <div className={s.divider} />
      </div>

      <div className={s.inner}>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          反馈分类管理
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          功能投票 & 看板
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          富文本内容
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          团队管理员
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          外观个性化设置
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          SEO 优化
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          页头页脚自定义
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          评论表情反馈
        </div>
        <div className={cn(s.item, 'w-1/3')}>
          <CheckSVG className={s.checkIcon} />
          丰富第三方集成
        </div>
      </div>
    </div>
  )
}

export default MaskPanel
