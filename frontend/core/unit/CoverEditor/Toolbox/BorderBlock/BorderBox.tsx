import { createKeyboardClick } from '~/lib/a11y'

import { LINEAR_BORDER } from '../../constant'
import useSalon, { cn } from '../../salon/toolbox/border_block/border_box'
import useLogic from '../../useLogic'

const BorderBox = ({ linearBorderPos, pos }) => {
  const { linearBorderPosOnChange } = useLogic()
  const active = linearBorderPos === LINEAR_BORDER[pos]

  const s = useSalon({ pos, active })

  return (
    <div
      className={cn(s.borderBox, active && s.active)}
      style={s.borderBoxStyle}
      role='button'
      tabIndex={0}
      onClick={() => linearBorderPosOnChange(LINEAR_BORDER[pos])}
      onKeyDown={createKeyboardClick(() => linearBorderPosOnChange(LINEAR_BORDER[pos]))}
    >
      <div className={s.boxInner} />
    </div>
  )
}

export default BorderBox
