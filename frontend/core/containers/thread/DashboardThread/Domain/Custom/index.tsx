import type { FC } from 'react'

import useSalon from '../../salon/domain/custom'
import DomainAdder from './DomainAdder'
import StepBar from './StepBar'

const Domain: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <StepBar />
      <DomainAdder />
    </div>
  )
}

export default Domain
