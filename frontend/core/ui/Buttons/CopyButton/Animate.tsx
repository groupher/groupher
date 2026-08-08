import { type FC } from 'react'

import CopySVG from '~/icons/Copy'

import useSalon from '../salon/copy_button'

type TProps = {
  done: boolean
}

const CopyButton: FC<TProps> = ({ done }) => {
  const s = useSalon()

  return (
    <div>
      {!done && <CopySVG className={s.copyIcon} />}
      {done && (
        <div className={s.copyedHint}>
          <div className={s.copyedText}>已复制</div>
        </div>
      )}
    </div>
  )
}

export default CopyButton
