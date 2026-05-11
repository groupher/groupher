import type { FC } from 'react'

import SavingBar from '../SavingBar'
import Editor from './Editors'
import Templates from './Templates'
import useHeaderLinksDraft from './useHeaderLinksDraft'

const Header: FC = () => {
  const { draftLinks, isTouched, makeId, resetDraft, saveDraft, setDraftLinks } =
    useHeaderLinksDraft()

  return (
    <>
      <Templates links={draftLinks} />
      <div className='mt-4' />
      <Editor links={draftLinks} makeId={makeId} onChange={setDraftLinks} />

      <SavingBar isTouched={isTouched} top={10} onCancel={resetDraft} onConfirm={saveDraft} />
    </>
  )
}

export default Header
