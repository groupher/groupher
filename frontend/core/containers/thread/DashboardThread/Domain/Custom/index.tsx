import type { FC } from 'react'

import useSalon from '../../salon/domain/custom'
// import DomainAdder from './DomainAdder'
import StepBar from './StepBar'
// import DNSSetup from './DNSSetup'
import VerifyDomain from './VerifyDomain'

const Domain: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <StepBar />
      {/* <DomainAdder /> */}
      {/* <DNSSetup /> */}
      <VerifyDomain />
    </div>
  )
}

export default Domain
