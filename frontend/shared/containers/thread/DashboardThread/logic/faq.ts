// import { find, findIndex } from 'ramda'

// import type { TFAQSection } from '~/spec'

// import type { TStore } from '../store'
// import { DEFAULT_NEW_FAQ } from '../constant'

// let store: TStore | undefined

// export const addFAQSection = (): void => {
//   const { faqSections } = store
//   const index = faqSections.length

//   store.mark({ editingFAQ: { ...DEFAULT_NEW_FAQ, index }, editingFAQIndex: index })
// }

// export const triggerEditFAQ = (index: number | null): void => {
//   if (index === null) {
//     store.mark({ editingFAQ: null, editingFAQIndex: null })
//     return
//   }
//   const { faqSections } = store
//   const editingFAQ = find((faq: TFAQSection) => faq.index === index, faqSections)

//   store.mark({ editingFAQIndex: index, editingFAQ })
// }

// export const updateEditingFAQ = (faq: TFAQSection): void => store.mark({ editingFAQ: faq })

// export const moveUpFAQ = (faqSection: TFAQSection): void => _moveFAQ(faqSection, 'up')
// export const moveDownFAQ = (faqSection: TFAQSection): void => _moveFAQ(faqSection, 'down')

// const _moveFAQ = (faqSection: TFAQSection, opt: 'up' | 'down'): void => {
//   const { faqSections } = store
//   const _faqSections = faqSections

//   const curIndex = findIndex((item: TFAQSection) => item.index === faqSection.index, _faqSections)
//   const targetIndex = opt === 'up' ? curIndex - 1 : curIndex + 1

//   const tmp = _faqSections[targetIndex]
//   _faqSections[targetIndex] = _faqSections[curIndex]
//   _faqSections[curIndex] = tmp

//   store.mark({ faqSections: _faqSections })

//   setTimeout(() => {
//     store.mark({ faqSections: _reindex(_faqSections) })
//   })
// }

// const _reindex = (faqSections: TFAQSection[]): TFAQSection[] => {
//   return faqSections.map((item, index) => ({
//     ...item,
//     index,
//   }))
// }

// export const init = (_store: TStore): void => {
//   store = _store
// }
