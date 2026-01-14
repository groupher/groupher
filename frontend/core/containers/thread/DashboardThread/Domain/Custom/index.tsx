import { type FC, useState } from 'react'

import useSalon from '../../salon/domain/custom'
import { STEPS, type TStep } from './constant'
import DNSSetup from './DNSSetup'
import DomainAdder from './DomainAdder'
import StepBar from './StepBar'
import VerifyDomain from './VerifyDomain'

const Domain: FC = () => {
  const s = useSalon()
  const [step, setStep] = useState<TStep>(STEPS.ADD_DOMAIN)

  return (
    <div className={s.wrapper}>
      <StepBar step={step} />

      {step === STEPS.ADD_DOMAIN && <DomainAdder onNext={() => setStep(STEPS.DNS_SETUP)} />}
      {step === STEPS.DNS_SETUP && <DNSSetup onNext={() => setStep(STEPS.VERIFY_DOMAIN)} />}
      {step === STEPS.VERIFY_DOMAIN && <VerifyDomain />}
    </div>
  )
}

export default Domain
