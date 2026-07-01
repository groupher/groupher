import type { FC } from 'react'

import FileImageSVG from '~/icons/FileImage'
import QuestionSVG from '~/icons/Question'
import TrashSVG from '~/icons/Trash'

import useSalon from './salon/footer'

const Footer: FC = () => {
  const s = useSalon()

  return (
    <footer className={s.wrapper}>
      <div className={s.divider} />
      <div className={s.content}>
        <button type='button' className={s.iconButton} aria-label='Trash'>
          <TrashSVG className={s.icon} />
          <span className={s.count}>0</span>
        </button>
        <div className={s.grow} />
        <button type='button' className={s.iconButton} aria-label='Assets'>
          <FileImageSVG className={s.icon} />
          <span className={s.count}>0</span>
        </button>
        <button type='button' className={s.iconOnlyButton} aria-label='Help'>
          <QuestionSVG className={s.icon} />
        </button>
      </div>
    </footer>
  )
}

export default Footer
