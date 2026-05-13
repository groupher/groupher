import type { FC } from 'react'

import { FOOTER_LAYOUT } from '~/const/layout'

import { FIELD } from '../constant'
import useFooter from '../logic/useFooter'
import SavingBar from '../SavingBar'
import Editor from './Editors'
import Templates from './Templates'

const Footer: FC = () => {
  const { footerLayout, isFooterLinksTouched, isFooterOnelineLinksTouched } = useFooter()
  const activeLinkField =
    footerLayout === FOOTER_LAYOUT.ONELINE ? FIELD.FOOTER_ONELINE_LINKS : FIELD.FOOTER_LINKS
  const inactiveLinkField =
    footerLayout === FOOTER_LAYOUT.ONELINE ? FIELD.FOOTER_LINKS : FIELD.FOOTER_ONELINE_LINKS
  const activeFieldTouched =
    footerLayout === FOOTER_LAYOUT.ONELINE ? isFooterOnelineLinksTouched : isFooterLinksTouched
  const inactiveFieldTouched =
    footerLayout === FOOTER_LAYOUT.ONELINE ? isFooterLinksTouched : isFooterOnelineLinksTouched
  const savingField = activeFieldTouched
    ? activeLinkField
    : inactiveFieldTouched
      ? inactiveLinkField
      : activeLinkField
  const isTouched = activeFieldTouched || inactiveFieldTouched

  return (
    <>
      <Templates />
      <br />
      <br />
      <Editor />

      <SavingBar field={savingField} isTouched={isTouched} top={10} />
    </>
  )
}

export default Footer
