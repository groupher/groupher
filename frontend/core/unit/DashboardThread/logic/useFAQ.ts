import { find, findIndex, reject } from 'ramda'

import type { TDocFAQLayout, TEditFunc, TFAQSection } from '~/spec'
import useCommunity from '~/stores/community/hooks'
import useDashboard from '~/stores/dashboard/hooks'

import { DEFAULT_NEW_FAQ, FIELD } from '../constant'
import useHelper from './useHelper'

const FAQ_SECTIONS_FIELD = FIELD.FAQ_SECTIONS

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
  const dsb$ = useDashboard()
  const community$ = useCommunity()
  const { edit } = useHelper()
  const { faqSections } = dsb$

  const addFAQSection = (): void => {
    const index = faqSections.length
    dsb$.commit({ editingFAQ: { ...DEFAULT_NEW_FAQ, index }, editingFAQIndex: index })
  }

  const triggerEditFAQ = (index: number | null): void => {
    if (index === null) {
      dsb$.commit({ editingFAQ: null, editingFAQIndex: null })
      return
    }

    const editingFAQ = find((faq: TFAQSection) => faq.index === index, faqSections)
    dsb$.commit({ editingFAQIndex: index, editingFAQ })
  }

  const updateEditingFAQ = (faq: TFAQSection): void => dsb$.commit({ editingFAQ: faq })

  const deleteFAQSection = (index: number): void => {
    const community = community$.slug

    dsb$.editField(
      FAQ_SECTIONS_FIELD,
      reject((faq: TFAQSection) => faq.index === index, faqSections),
    )
    dsb$.commit({ savingField: FIELD.FAQ_SECTION_DELETE })

    const params = { faqs: dsb$.faqSections, community }
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

    dsb$.editField(FAQ_SECTIONS_FIELD, nextSections)
    setTimeout(() => {
      dsb$.editField(
        FAQ_SECTIONS_FIELD,
        nextSections.map((item, index) => ({
          ...item,
          index,
        })),
      )
    })
  }

  return {
    edit,
    docFaqLayout: dsb$[FIELD.DOC_FAQ_LAYOUT],
    saving: dsb$.saving,
    addFAQSection,
    triggerEditFAQ,
    updateEditingFAQ,
    deleteFAQSection,
    moveUpFAQ: (faqSection) => moveFAQ(faqSection, 'up'),
    moveDownFAQ: (faqSection) => moveFAQ(faqSection, 'down'),
  }
}
