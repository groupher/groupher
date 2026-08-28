import useTrans from '~/hooks/useTrans'

import { FIELD } from '../constant'
import useIndexTouched from '../logic/useTags/useIndexTouched'
import SavingBar from '../SavingBar'

export default function Footer() {
  const isTouched = useIndexTouched()
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
