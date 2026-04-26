import useTrans from '~/hooks/useTrans'

import { FIELD } from '../constant'
import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'

export default function Footer() {
  const { tagsIndexTouched: isTouched } = useTags()
  const { t } = useTrans()

  return (
    <SavingBar
      isTouched={isTouched}
      field={FIELD.TAG_INDEX}
      prefix={t('dsb.tags.sort_prefix')}
      top={10}
    />
  )
}
