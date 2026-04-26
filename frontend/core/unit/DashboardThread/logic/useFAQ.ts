import { find, findIndex, pick, reject } from 'ramda'

import type { TDocFAQLayout, TEditFunc, TFAQSection } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { DEFAULT_NEW_FAQ, FIELD } from '../constant'
import useHelper from './useHelper'

type TRet = {
  docFaqLayout: TDocFAQLayout
  saving: boolean
  edit: TEditFunc
  addFAQSection: () => void
  triggerEditFAQ: (index: number | null) => void
  deleteFAQSection: (index: number) => void
  updateEditingFAQ: (faq: TFAQSection) => void
  moveUpFAQ: (faqSection: TFAQSection) => void
  moveDownFAQ: (faqSection: TFAQSection) => void
}

export default function useFAQ(): TRet {
  const dashboard$ = useDashboard()
  const community$ = useCommunity()
  const { edit } = useHelper()
  const { faqSections } = dashboard$

  const addFAQSection = (): void => {
    const index = faqSections.length
    dashboard$.commit({ editingFAQ: { ...DEFAULT_NEW_FAQ, index }, editingFAQIndex: index })
  }

  const triggerEditFAQ = (index: number | null): void => {
    if (index === null) {
      dashboard$.commit({ editingFAQ: null, editingFAQIndex: null })
      return
    }

    const editingFAQ = find((faq: TFAQSection) => faq.index === index, faqSections)
    dashboard$.commit({ editingFAQIndex: index, editingFAQ })
  }

  const updateEditingFAQ = (faq: TFAQSection): void => dashboard$.commit({ editingFAQ: faq })

  const deleteFAQSection = (index: number): void => {
    const community = community$.slug

    dashboard$.commit({
      faqSections: reject((faq: TFAQSection) => faq.index === index, faqSections),
      savingField: FIELD.FAQ_SECTION_DELETE,
    })

    const params = { faqs: dashboard$.faqSections, community }
    console.log('## deleteFAQSection: ', params)
  }

  const moveFAQ = (faqSection: TFAQSection, direction: 'up' | 'down'): void => {
    const nextSections = [...faqSections]
    const currentIndex = findIndex(
      (item: TFAQSection) => item.index === faqSection.index,
      nextSections,
    )
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

    const target = nextSections[targetIndex]
    nextSections[targetIndex] = nextSections[currentIndex]
    nextSections[currentIndex] = target

    dashboard$.commit({ faqSections: nextSections })
    setTimeout(() => {
      dashboard$.commit({
        faqSections: nextSections.map((item, index) => ({
          ...item,
          index,
        })),
      })
    })
  }

  return {
    edit,
    ...pick(['docFaqLayout', 'saving'], dashboard$),
    addFAQSection,
    triggerEditFAQ,
    updateEditingFAQ,
    deleteFAQSection,
    moveUpFAQ: (faqSection) => moveFAQ(faqSection, 'up'),
    moveDownFAQ: (faqSection) => moveFAQ(faqSection, 'down'),
  }
}
