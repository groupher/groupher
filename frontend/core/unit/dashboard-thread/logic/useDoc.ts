import { pick } from 'ramda'
import { COLOR } from '~/const/colors'
import useDashboard from '~/stores/dashboard/hooks'
import type { TDocFAQLayout, TDocLayout, TEditFunc } from '~/spec'
import { DEFAULT_NEW_FAQ } from '../constant'
import useHelper from './useHelper'

type TRet = {
  docLayout: TDocLayout
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

  const isTouched = isChanged('docLayout')
  const isFaqTouched = isChanged('docFaqLayout')

  return {
    edit,
    ...pick(['docLayout', 'docFaqLayout', 'saving'], dsb$),
    isTouched,
    isFaqTouched,
    addFAQSection,
    addDocCategory,
  }
}
