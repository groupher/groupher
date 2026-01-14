import type { FC } from 'react'

import useSalon from '../../salon/domain/custom'
import DNSSetup from './DNSSetup'
// import DomainAdder from './DomainAdder'
import StepBar from './StepBar'

const Domain: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <StepBar />
      {/* <DomainAdder /> */}
      <DNSSetup />
    </div>
  )
}

export default Domain
