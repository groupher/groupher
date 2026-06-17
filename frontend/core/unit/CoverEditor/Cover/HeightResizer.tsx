import type { FC, PointerEventHandler } from 'react'

import useSalon, { cn } from './salon/height_resizer'

type TProps = {
  onPointerCancel: PointerEventHandler<HTMLButtonElement>
  onPointerDown: PointerEventHandler<HTMLButtonElement>
  onPointerMove: PointerEventHandler<HTMLButtonElement>
  onPointerUp: PointerEventHandler<HTMLButtonElement>
  visible: boolean
}

const HeightResizer: FC<TProps> = ({
  onPointerCancel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  visible,
}) => {
  const s = useSalon()

  return (
    <button
      type='button'
      className={cn(s.wrapper, visible && s.wrapperVisible)}
      aria-label='Resize cover height'
      aria-hidden={!visible}
      disabled={!visible}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <span className={s.line} />
      <span className={s.grip}>
        <span className={s.dot} />
        <span className={s.dot} />
      </span>
    </button>
  )
}

export default HeightResizer
