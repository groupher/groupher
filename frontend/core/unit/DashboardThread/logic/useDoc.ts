import { pick } from 'ramda'

import { COLOR } from '~/const/colors'
import useTrans from '~/hooks/useTrans'
import type { TDocCoverLayout, TDocFAQLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  docCoverLayout: TDocCoverLayout
  docFaqLayout: TDocFAQLayout
  saving: boolean
  isTouched: boolean
  isFaqTouched: boolean
  edit: TEditFunc

  addDocCategory: () => void
}

export default function useDoc(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()
  const { t } = useTrans()

  const addDocCategory = (): void => {
    const docCategories = dsb$.docCategories.concat({
      name: t('dsb.cms.docs.category.new'),
      index: dsb$.docCategories.length,
      color: COLOR.BLACK,
      files: [],
    })

    dsb$.commit({ docCategories })
  }

  const isTouched = isChanged(FIELD.DOC_COVER_LAYOUT)
  const isFaqTouched = isChanged(FIELD.DOC_FAQ_LAYOUT)

  return {
    edit,
    ...pick(['docCoverLayout', 'docFaqLayout', 'saving'], dsb$),
    isTouched,
    isFaqTouched,
    addDocCategory,
  }
}
