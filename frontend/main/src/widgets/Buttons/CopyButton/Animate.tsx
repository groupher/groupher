import { type FC, useEffect, useState } from 'react'

import CopySVG from '~/icons/Copy'
import useSalon from '../salon/copy_button'

const CopyButton: FC = () => {
  const s = useSalon()

  const [done, setDone] = useState(false)

  useEffect(() => {
    if (done) setTimeout(() => setDone(false), 3000)
  }, [done])

  return (
    <div>
      {!done && <CopySVG className={s.copyIcon} onClick={() => setDone(true)} />}
      {done && (
        <div className={s.copyedHint}>
          <div className={s.copyedText}>已复制</div>
        </div>
      )}
    </div>
  )
}

export default CopyButton
