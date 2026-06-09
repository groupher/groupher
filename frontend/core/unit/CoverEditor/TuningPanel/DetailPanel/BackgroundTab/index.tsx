import type { TBgConfig } from '~/lib/bg/spec'

import GradientsSection from './GradientsSection'
import PicturesSection from './PictureSection'
import useSalon from './salon'
import TuningSection from './TuningSection'

type TProps = {
  background: TBgConfig
}

export default function BackgroundTab({ background }: TProps) {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <GradientsSection background={background} />
      <PicturesSection background={background} />
      <TuningSection background={background} />
    </section>
  )
}
