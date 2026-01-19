import type { FC } from 'react'

import { FIELD } from '../constant'
import useHeader from '../logic/useHeader'
import SavingBar from '../SavingBar'
import useSalon from '../salon/header'
import Editor from './Editors'
import Templates from './Templates'

const Header: FC = () => {
  const s = useSalon()

  const { saving, isHeaderLinksTouched: isTouched } = useHeader()

  return (
    <div className={s.wrapper}>
      <div className={s.inner}>
        <Templates />
        <div className='mt-4' />
        <Editor />

        <SavingBar field={FIELD.HEADER_LINKS} isTouched={isTouched} loading={saving} top={10} />
      </div>
    </div>
  )
}

export default Header
