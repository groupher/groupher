import { pick } from 'ramda'

import { COLOR } from '~/const/colors'
import type { TDocCoverLayout, TDocFAQLayout, TEditFunc } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { DEFAULT_NEW_FAQ } from '../constant'
import useHelper from './useHelper'

type TRet = {
  docCoverLayout: TDocCoverLayout
  docFaqLayout: TDocFAQLayout
  saving: boolean
  isTouched: boolean
  isFaqTouched: boolean
  edit: TEditFunc

  addFAQSection: () => void
  addDocCategory: () => void
}

export default function useDoc(): TRet {
  const dsb$ = useDashboard()
  const { isChanged, edit } = useHelper()

  const addFAQSection = (): void => {
    const { faqSections } = dsb$
    const index = faqSections.length

    dsb$.commit({ editingFAQ: { ...DEFAULT_NEW_FAQ, index }, editingFAQIndex: index })
  }

  const addDocCategory = (): void => {
    const docCategories = dsb$.docCategories.concat({
      name: '新分类',
      index: dsb$.docCategories.length,
      color: COLOR.BLACK,
      files: [],
    })

    dsb$.commit({ docCategories })
  }

  const isTouched = isChanged('docCoverLayout')
  const isFaqTouched = isChanged('docFaqLayout')

  return {
    edit,
    ...pick(['docCoverLayout', 'docFaqLayout', 'saving'], dsb$),
    isTouched,
    isFaqTouched,
    addFAQSection,
    addDocCategory,
  }
}
