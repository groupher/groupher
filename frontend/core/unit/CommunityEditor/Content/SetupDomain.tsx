import { STEP } from '../constant'
import useSalon from '../salon/content/setup_domain'
import useLogic from '../useLogic'
import FakeBrowser from './FakeBrowser'

export default function SetupDomain() {
  const s = useSalon()

  const { slug, communityType } = useLogic()

  return (
    <div className={s.wrapper}>
      <FakeBrowser domain={slug} step={STEP.SETUP_DOMAIN} communityType={communityType} />
    </div>
  )
}
