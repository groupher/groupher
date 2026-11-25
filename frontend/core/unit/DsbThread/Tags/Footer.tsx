import useTrans from '~/hooks/useTrans'
import { toast } from '~/ui/Toaster'

import useTags from '../logic/useTags'
import SavingBar from '../SavingBar'

export default function Footer() {
  const { hasSortingChanges, resetTagSorting, saveTagSorting, saving } = useTags()
  const { t } = useTrans()

  const confirmSorting = async (): Promise<void> => {
    try {
      await saveTagSorting()
    } catch (error) {
      toast(String(error), 'error')
    }
  }

  return (
    <SavingBar
      isTouched={hasSortingChanges}
      loading={saving}
      onCancel={resetTagSorting}
      onConfirm={() => void confirmSorting()}
      prefix={t('dsb.tags.sort_prefix')}
      top={10}
    />
  )
}
