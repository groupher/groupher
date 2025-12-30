import { FIELD } from '../constant'
import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'

export default () => {
  const { tagsIndexTouched: isTouched } = useTags()

  return (
    <SavingBar isTouched={isTouched} field={FIELD.TAG_INDEX} prefix='是否保存标签排序' top={10} />
  )
}
