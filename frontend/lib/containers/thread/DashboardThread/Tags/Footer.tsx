import { SETTING_FIELD } from '../constant'
import SavingBar from '../SavingBar'

import useTags from '../logic/useTags'

export default () => {
  const { getTagsIndexTouched } = useTags()
  const isTouched = getTagsIndexTouched()

  return (
    <SavingBar
      isTouched={isTouched}
      field={SETTING_FIELD.TAG_INDEX}
      prefix="是否保存标签排序"
      top={10}
    />
  )
}
