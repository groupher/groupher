import FakeBrowser from './FakeBrowser'

import { STEP } from '../constant'

import useLogic from '../useLogic'
import useSalon from '../styles/content/setup_domain'

export default () => {
  const s = useSalon()

  const { slug, communityType } = useLogic()

  return (
    <div className={s.wrapper}>
      <FakeBrowser domain={slug} step={STEP.SETUP_DOMAIN} communityType={communityType} />
    </div>
  )
}
