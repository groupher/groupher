import useTrans from '~/hooks/useTrans'
import CheckSVG from '~/icons/CheckCircle'
import useSalon, { cn } from '../../salon/domain/custom/step_bar'
import type { TDomainStep } from './constant'
import { DOMAIN_STEP_ORDER, STEPS } from './constant'

type Props = {
  step: TDomainStep
}

export default function StepBar({ step }: Props) {
  const s = useSalon()
  const { t } = useTrans()
  const activeIndex = DOMAIN_STEP_ORDER.indexOf(step)

  const stepLabels: Record<TDomainStep, { hint: string; title: string }> = {
    [STEPS.ADD_DOMAIN]: {
      hint: t('dsb.domain.custom.step.add.hint'),
      title: t('dsb.domain.custom.step.add.title'),
    },
    [STEPS.DNS_SETUP]: {
      hint: t('dsb.domain.custom.step.dns.hint'),
      title: t('dsb.domain.custom.step.dns.title'),
    },
    [STEPS.VERIFY_DOMAIN]: {
      hint: t('dsb.domain.custom.step.verify.hint'),
      title: t('dsb.domain.custom.step.verify.title'),
    },
  }

  return (
    <div className={s.wrapper}>
      {DOMAIN_STEP_ORDER.map((itemStep, idx) => {
        const isCompleted = idx < activeIndex
        const isInactive = idx > activeIndex

        const { hint, title } = stepLabels[itemStep]

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
