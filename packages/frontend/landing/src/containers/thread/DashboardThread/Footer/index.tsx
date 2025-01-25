import type { FC } from 'react'

import { SETTING_FIELD } from '../constant'

import SavingBar from '../SavingBar'

import Templates from './Templates'
import Editor from './Editors'

import useFooter from '../logic/useFooter'
import useSalon from '../salon/footer'

const Footer: FC = () => {
  const s = useSalon()
  const { saving, getIsTouched } = useFooter()
  const isTouched = getIsTouched('footerLinks')

  return (
    <div className={s.wrapper}>
      <Templates />
      <br />
      <br />
      <Editor />

      <SavingBar
        field={SETTING_FIELD.FOOTER_LINKS}
        isTouched={isTouched}
        loading={saving}
        top={10}
        width="w-11/12"
      />
    </div>
  )
}

export default Footer
