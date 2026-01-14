import CheckSVG from '~/icons/CheckCircle'
import useSalon, { cn } from '../../salon/domain/custom/step_bar'
import type { TDomainStep } from './constant'
import { DOMAIN_STEP_ORDER, STEPS } from './constant'

type Props = {
  step: TDomainStep
}

const STEP_LABELS: Record<TDomainStep, { hint: string; title: string }> = {
  [STEPS.ADD_DOMAIN]: { hint: '第 1 步', title: '添加自定义域名' },
  [STEPS.DNS_SETUP]: { hint: '第 2 步', title: '配置 DNS 记录' },
  [STEPS.VERIFY_DOMAIN]: { hint: '第 3 步', title: '域名验证 / 绑定' },
}

export default function StepBar({ step }: Props) {
  const s = useSalon()
  const activeIndex = DOMAIN_STEP_ORDER.indexOf(step)

  return (
    <div className={s.wrapper}>
      {DOMAIN_STEP_ORDER.map((itemStep, idx) => {
        const isCompleted = idx < activeIndex
        const isInactive = idx > activeIndex

        const { hint, title } = STEP_LABELS[itemStep]

        return (
          <div key={itemStep} className={s.block}>
            <div className={s.hint}>
              {hint}
              {isCompleted && <CheckSVG className={s.checkIcon} />}
            </div>

            <div className={cn(s.title, isInactive && s.inActive)}>{title}</div>
          </div>
        )
      })}
    </div>
  )
}
