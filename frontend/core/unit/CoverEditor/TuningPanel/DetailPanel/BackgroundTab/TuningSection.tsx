import type { TBgConfig } from '~/lib/bg/spec'

import GroupTitle from '../GroupTitle'
import useSalon from './salon/tuning'
import Tuning from './Tuning'

type TProps = {
  background: TBgConfig
}

export default function TuningSection({ background }: TProps) {
  const s = useSalon()

  return (
    <div className={s.section}>
      <GroupTitle>Tuning</GroupTitle>
      <Tuning background={background} />
    </div>
  )
}
