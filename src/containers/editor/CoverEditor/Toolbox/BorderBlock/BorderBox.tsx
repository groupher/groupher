import { LINEAR_BORDER } from '../../constant'
import useLogic from '../../useLogic'
import useSalon, { cn } from '../../styles/toolbox/border_block/border_box'

const BorderBox = ({ linearBorderPos, pos }) => {
  const { linearBorderPosOnChange } = useLogic()
  const active = linearBorderPos === LINEAR_BORDER[pos]

  const s = useSalon({ pos, active })

  return (
    <div
      className={cn(s.borderBox, active && s.active)}
      style={s.borderBoxStyle}
      onClick={() => linearBorderPosOnChange(LINEAR_BORDER[pos])}
    >
      <div className={s.boxInner} />
    </div>
  )
}

export default BorderBox
