import type { FC } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'

import useFooter from '../../logic/useFooter'
import GroupEditor from './Group'
import OnelineEditor from './Oneline'

const Editor: FC = () => {
  const { footerLayout } = useFooter()

  return (
    <>
      {footerLayout === FOOTER_LAYOUT.ONELINE && <OnelineEditor />}
      {footerLayout === FOOTER_LAYOUT.GROUP && <GroupEditor />}
    </>
  )
}

export default Editor
