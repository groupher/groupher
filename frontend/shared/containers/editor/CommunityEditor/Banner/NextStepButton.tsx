import type { FC } from 'react'

import Button from '~/widgets/Buttons/Button'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

type TProps = {
  loading?: boolean
  onClick: () => void
  disabled: boolean
  text?: string
}

const NextStepButton: FC<TProps> = ({ loading = false, onClick, disabled, text = '下一步' }) => {
  return (
    <>
      {loading ? (
        <LavaLampLoading />
      ) : (
        <Button disabled={disabled} onClick={onClick}>
          {text}
        </Button>
      )}
    </>
  )
}

export default NextStepButton
