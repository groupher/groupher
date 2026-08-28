import { type FC, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import AddTabButton from './AddTabButton'

export const ADD_TAB_BREADCRUMB_SLOT_ID = 'docs-editor-add-tab-slot'

type TProps = {
  show: boolean
}

const AddTabPortal: FC<TProps> = ({ show }) => {
  const [target, setTarget] = useState<HTMLElement | null>(null)

  useLayoutEffect(() => {
    setTarget(document.getElementById(ADD_TAB_BREADCRUMB_SLOT_ID))
  }, [])

  if (!show || !target) return null

  return createPortal(<AddTabButton />, target)
}

export default AddTabPortal
