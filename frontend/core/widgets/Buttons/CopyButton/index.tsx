import { type FC, lazy, Suspense } from 'react'
import { CopyToClipboard } from 'react-copy-to-clipboard'

import IconButton from '../IconButton'
import useSalon from '../salon/copy_button'

const AnimatedCopyButton = lazy(() => import('./Animate'))

type TProps = {
  value: string
}

const CopyButton: FC<TProps> = ({ value }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <CopyToClipboard text={value}>
        <Suspense fallback={<IconButton path='article/clipboard.svg' right={5} />}>
          {/*  @ts-ignore */}
          <AnimatedCopyButton />
        </Suspense>
      </CopyToClipboard>
    </div>
  )
}

export default CopyButton
