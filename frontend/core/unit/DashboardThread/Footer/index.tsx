import type { FC } from 'react'

import { FIELD } from '../constant'
import useFooter from '../logic/useFooter'
import SavingBar from '../SavingBar'
import Editor from './Editors'
import Templates from './Templates'

const Footer: FC = () => {
  const { isFooterLinksTouched: isTouched } = useFooter()

  return (
    <>
      <Templates />
      <br />
      <br />
      <Editor />

      <SavingBar field={FIELD.FOOTER_LINKS} isTouched={isTouched} top={10} />
    </>
  )
}

export default Footer
