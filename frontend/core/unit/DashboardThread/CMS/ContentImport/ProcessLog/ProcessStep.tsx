import CheckSVG from '~/icons/Check'
import LoadingGapSVG from '~/icons/LoadingGap'
import WarningSVG from '~/icons/Warning'

import useSalon from './salon/process_step'

type TProps = {
  details: string[]
  label: string
  status: 'active' | 'completed' | 'failed' | 'pending'
}

/** Renders one labeled process stage with active/completed/failed detail state. */
export default function ProcessStep({ details, label, status }: TProps) {
  const s = useSalon()

  return (
    <li className={s.item}>
      <span
        className={
          status === 'active'
            ? s.activeIconBox
            : status === 'completed'
              ? s.iconBox
              : status === 'failed'
                ? s.failedIconBox
                : s.pendingIconBox
        }
        aria-hidden
      >
        {status === 'active' ? <LoadingGapSVG className={s.loadingIcon} /> : null}
        {status === 'completed' ? <CheckSVG className={s.checkIcon} /> : null}
        {status === 'failed' ? <WarningSVG className={s.failedIcon} /> : null}
        {status === 'pending' ? <span className={s.pendingDot} /> : null}
      </span>
      <div className={s.content}>
        <span
          className={
            status === 'active' ? s.activeLabel : status === 'pending' ? s.pendingLabel : s.label
          }
        >
          {label}
        </span>
        <ul className={s.details}>
          {details.map((detail) => (
            <li className={s.detail} key={detail}>
              <span className={s.detailDot} aria-hidden />
              <span className={status === 'active' ? s.activeDetailText : undefined}>{detail}</span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  )
}
