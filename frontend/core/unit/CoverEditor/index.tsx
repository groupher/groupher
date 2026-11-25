import { forwardRef } from 'react'

import CoverEditorContent from './CoverEditorContent'
import type { TCoverEditorHandle } from './spec'
import CoverEditorProvider from './store/provider'

type TProps = {
  onDelete?: () => void
  onReplace?: () => void
}

const CoverEditor = forwardRef<TCoverEditorHandle, TProps>((props, ref) => (
  <CoverEditorProvider>
    <CoverEditorContent {...props} ref={ref} />
  </CoverEditorProvider>
))

CoverEditor.displayName = 'CoverEditor'

export default CoverEditor
