import useTrans from '~/hooks/useTrans'

import { PHASE } from '../constant'
import type { TImportPhase } from '../spec'
import Item from './Item'
import useSalon from './salon'

/** Projects the current import phase into the three-step product journey. */
export default function Stepper({ phase }: { phase: TImportPhase }) {
  const s = useSalon()
  const { t } = useTrans()
  const active =
    phase === PHASE.REPO || phase === PHASE.ANALYZING ? 0 : phase === PHASE.REVIEW ? 1 : 2
  const labels = [
    t('dsb.doc.bulk_import.step.repository'),
    t('dsb.doc.bulk_import.step.review'),
    t('dsb.doc.bulk_import.step.import'),
  ]

  return (
    <ol className={s.wrapper} aria-label={t('dsb.doc.bulk_import.progress')}>
      {labels.map((label, index) => (
        <Item
          completed={index < active}
          current={index === active}
          key={label}
          label={label}
          number={index + 1}
          reached={index <= active}
          showLine={index < labels.length - 1}
        />
      ))}
    </ol>
  )
}
