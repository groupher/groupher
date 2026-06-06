import AngleWheel from '~/widgets/AngleWheel'

import useLogic from '../../../../useLogic'
import GroupItem from '../../GroupItem'
import useSalon from './salon'

type TProps = {
  rotate: number
}

export default function Rotate({ rotate }: TProps) {
  const s = useSalon()
  const { rotateOnChange } = useLogic()

  return (
    <section className={s.wrapper}>
      <GroupItem label='Angle'>
        <AngleWheel value={rotate} label='Angle' onChange={rotateOnChange} />
      </GroupItem>
    </section>
  )
}
