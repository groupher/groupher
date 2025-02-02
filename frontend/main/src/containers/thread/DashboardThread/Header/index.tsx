import type { FC } from 'react'

import { SETTING_FIELD } from '../constant'

import SavingBar from '../SavingBar'

import Templates from './Templates'
import Editor from './Editors'

import useHeader from '../logic/useHeader'
import useSalon from '../salon/header'

const Header: FC = () => {
  const s = useSalon()

  const { saving, getIsTouched } = useHeader()
  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <Templates />
      <div className="mt-4" />
      <Editor />

      <SavingBar
        field={SETTING_FIELD.HEADER_LINKS}
        isTouched={isTouched}
        loading={saving}
        top={10}
        width="w-11/12"
      />
    </div>
  )
}

export default Header
