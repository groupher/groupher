import type { TBgConfig } from '~/lib/bg'

import Gradients from './Gradients'
import Pictures from './Pictures'
import useSalon from './salon'
import TuningSection from './TuningSection'

type TProps = {
  background: TBgConfig
}

export default function BackgroundTab({ background }: TProps) {
  const s = useSalon()

  return (
    <section className={s.wrapper}>
      <Gradients background={background} />
      <Pictures background={background} />
      <TuningSection background={background} />
    </section>
  )
}
