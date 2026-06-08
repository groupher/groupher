import { STEP } from '../constant'
import useLogic from '../useLogic'
import FakeBrowser from './FakeBrowser'
import useSalon from './salon/setup_domain'

export default function SetupDomain() {
  const s = useSalon()

  const { slug, communityType } = useLogic()

  return (
    <div className={s.wrapper}>
      <FakeBrowser domain={slug} step={STEP.SETUP_DOMAIN} communityType={communityType} />
    </div>
  )
}
