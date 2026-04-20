import type { FC } from 'react'

import { FIELD } from '../constant'
import useHeader from '../logic/useHeader'
import SavingBar from '../SavingBar'
import Editor from './Editors'
import Templates from './Templates'

const Header: FC = () => {
  const { isHeaderLinksTouched: isTouched } = useHeader()

  return (
    <>
      <Templates />
      <div className='mt-4' />
      <Editor />

      <SavingBar field={FIELD.HEADER_LINKS} isTouched={isTouched} top={10} />
    </>
  )
}

export default Header
