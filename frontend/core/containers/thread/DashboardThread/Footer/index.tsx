import type { FC } from 'react'

import { FIELD } from '../constant'
import useFooter from '../logic/useFooter'
import SavingBar from '../SavingBar'
import useSalon from '../salon/footer'
import Editor from './Editors'
import Templates from './Templates'

const Footer: FC = () => {
  const s = useSalon()
  const { saving, isFooterLinksTouched: isTouched } = useFooter()

  return (
    <div className={s.wrapper}>
      <Templates />
      <br />
      <br />
      <Editor />

      <SavingBar
        field={FIELD.FOOTER_LINKS}
        isTouched={isTouched}
        loading={saving}
        top={10}
        width='w-11/12'
      />
    </div>
  )
}

export default Footer
