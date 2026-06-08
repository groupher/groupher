import type { FC } from 'react'

import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon from './salon/toggler_button'

type TProps = {
  text: string
  loading: boolean
  onClick: () => void
}

const TogglerButton: FC<TProps> = ({ text, loading, onClick }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.slashSign}>&#47;&#47;</div>
      {loading ? (
        <LavaLampLoading left={18} />
      ) : (
        <button type='button' className={s.text} onClick={onClick}>
          {text}
        </button>
      )}
    </div>
  )
}

export default TogglerButton
