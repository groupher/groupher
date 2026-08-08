import { type FC, lazy, Suspense, useEffect, useState } from 'react'

import useClipboard from '~/hooks/useClipboard'

import IconButton from '../IconButton'
import useSalon from '../salon/copy_button'

const AnimatedCopyButton = lazy(() => import('./Animate'))

type TProps = {
  value: string
}

const CopyButton: FC<TProps> = ({ value }) => {
  const s = useSalon()
  const [, copy] = useClipboard()
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(false), 3000)
    return () => clearTimeout(timer)
  }, [done])

  const handleCopy = () => {
    copy(value)
    setDone(true)
  }

  return (
    <div className={s.wrapper}>
      <button type='button' onClick={handleCopy} className='cursor-default' aria-label='copy'>
        <Suspense fallback={<IconButton path='article/clipboard.svg' right={5} />}>
          <AnimatedCopyButton done={done} />
        </Suspense>
      </button>
    </div>
  )
}

export default CopyButton
