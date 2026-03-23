import FakeBrowser from './FakeBrowser'

import { STEP } from '../constant'

import useLogic from '../useLogic'
import useSalon from '../salon/content/setup_domain'

export default function SetupDomain() {
  const s = useSalon()

  const { slug, communityType } = useLogic()

  return (
    <div className={s.wrapper}>
      <FakeBrowser domain={slug} step={STEP.SETUP_DOMAIN} communityType={communityType} />
    </div>
  )
}
