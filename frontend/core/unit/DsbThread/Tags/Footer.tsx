import useTrans from '~/hooks/useTrans'

import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'

export default function Footer() {
  const { hasSortingChanges, resetTagSorting, saveTagSorting, saving } = useTags()
  const { t } = useTrans()

  return (
    <SavingBar
      isTouched={hasSortingChanges}
      loading={saving}
      onCancel={resetTagSorting}
      onConfirm={() => void saveTagSorting()}
      prefix={t('dsb.tags.sort_prefix')}
      top={10}
    />
  )
}
