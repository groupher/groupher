import FakeBrowser from './FakeBrowser'

import { STEP } from '../constant'
import useLogic from '../useLogic'
import useSalon from '../salon/content/setup_domain'

export default function SetupInfo() {
  const s = useSalon()
  const { slug, title, desc, logo, communityType } = useLogic()

  return (
    <div className={s.wrapper}>
      <FakeBrowser
        domain={slug}
        communityType={communityType}
        title={title}
        desc={desc}
        logo={logo}
        step={STEP.SETUP_INFO}
      />
    </div>
  )
}
