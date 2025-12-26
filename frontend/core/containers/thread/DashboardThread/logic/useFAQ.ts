import { find, findIndex, pick, reject } from 'ramda'
import useCommunity from '~/hooks/useCommunity'
import useDashboard from '~/hooks/useDashboard'
import type { TDocFAQLayout, TEditFunc, TFAQSection } from '~/spec'
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

export default (): TRet => {
  const store = useDashboard()
  const { edit } = useHelper()
  const { faqSections } = store
  const curCommunity = useCommunity()

  const addFAQSection = (): void => {
    const index = faqSections.length

    store.commit({ editingFAQ: { ...DEFAULT_NEW_FAQ, index }, editingFAQIndex: index })
  }

  const triggerEditFAQ = (index: number | null): void => {
    if (index === null) {
      store.commit({ editingFAQ: null, editingFAQIndex: null })
      return
    }
    const { faqSections } = store
    const editingFAQ = find((faq: TFAQSection) => faq.index === index, faqSections)

    store.commit({ editingFAQIndex: index, editingFAQ })
  }

  const updateEditingFAQ = (faq: TFAQSection): void => store.commit({ editingFAQ: faq })

  const deleteFAQSection = (index: number): void => {
    const community = curCommunity.slug

    store.commit({
      faqSections: reject((faq: TFAQSection) => faq.index === index, faqSections),
      savingField: FIELD.FAQ_SECTION_DELETE,
    })
    const params = { faqs: store.faqSections, community }

    console.log('## deleteFAQSection: ', params)
    // sr71$.mutate(S.updateDashboardFaqs, { faqs: store.faqSections, community })
  }

  const moveUpFAQ = (faqSection: TFAQSection): void => moveFAQ(faqSection, 'up')
  const moveDownFAQ = (faqSection: TFAQSection): void => moveFAQ(faqSection, 'down')

  const moveFAQ = (faqSection: TFAQSection, opt: 'up' | 'down'): void => {
    const { faqSections } = store
    const _faqSections = [...faqSections]

    const curIndex = findIndex((item: TFAQSection) => item.index === faqSection.index, _faqSections)
    const targetIndex = opt === 'up' ? curIndex - 1 : curIndex + 1

    const tmp = _faqSections[targetIndex]
    _faqSections[targetIndex] = _faqSections[curIndex]
    _faqSections[curIndex] = tmp

    store.commit({ faqSections: _faqSections })

    setTimeout(() => {
      store.commit({ faqSections: _reindex(_faqSections) })
    })
  }

  const _reindex = (faqSections: TFAQSection[]): TFAQSection[] => {
    return faqSections.map((item, index) => ({
      ...item,
      index,
    }))
  }

  return {
    edit,
    ...pick(['docFaqLayout', 'saving'], store),
    addFAQSection,
    triggerEditFAQ,
    updateEditingFAQ,
    deleteFAQSection,
    moveUpFAQ,
    moveDownFAQ,
  }
}
