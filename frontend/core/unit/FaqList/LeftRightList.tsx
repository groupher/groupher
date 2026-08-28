import type { TFAQSection, TSpace } from '~/spec'

import LeftRight from './LeftRight'
import useSalon from './salon'

type TProps = {
  sections: TFAQSection[]
} & TSpace

export default function LeftRightList({ sections, ...spacing }: TProps) {
  const s = useSalon(spacing)

  return (
    <div className={s.wrapper}>
      <LeftRight sections={sections} />
    </div>
  )
}
