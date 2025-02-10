import useTouch, { type TRet as TTouch } from './useTouch'
import useEdit, { type TRet as TEdit } from './useEdit'

type TRet = TTouch & TEdit

export default (): TRet => {
  const { isChanged, anyChanged, mapArrayChanged } = useTouch()
  const { edit, rollbackEdit, resetEdit, onSave } = useEdit()

  return {
    isChanged,
    anyChanged,
    mapArrayChanged,
    edit,
    rollbackEdit,
    resetEdit,
    onSave,
  }
}
