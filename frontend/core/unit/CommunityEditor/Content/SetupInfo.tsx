import { STEP } from '../constant'
import useLogic from '../useLogic'
import FakeBrowser from './FakeBrowser'
import useSalon from './salon/setup_domain'

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
