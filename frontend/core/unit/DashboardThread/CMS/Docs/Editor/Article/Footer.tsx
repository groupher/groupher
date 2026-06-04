import type { FC } from 'react'

import FeedbackSpectrum from '~/widgets/FeedbackSpectrum'

import useSalon from './salon/footer'

const Footer: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <FeedbackSpectrum />
    </div>
  )
}

export default Footer
