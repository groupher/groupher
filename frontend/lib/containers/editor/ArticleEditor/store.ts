// /*
//  * ArticleEditor store
//  *
//  */

// import { pick, values } from 'ramda'

// import type { TID, TArticle, TSubmitState, TEditMode, TGroupedTags, TTag } from '~/spec'

// import { ARTICLE_CAT } from '~/const/gtd'

// import type { TTexts, TEditData } from './spec'

// const ArticleEditor = T.model('ArticleEditor', {
//   mode: T.opt(T.enum(['publish', 'update']), 'publish'),
//   isArchived: T.opt(T.bool, false),
//   archivedAt: T.maybeNull(T.string),

//   title: T.opt(T.string, ''),
//   author: T.maybeNull(User),
//   body: T.opt(T.string, '{}'),
//   linkAddr: T.opt(T.string, ''),
//   copyRight: T.opt(T.string, 'cc'),
//   isQuestion: T.opt(T.bool, false),
//   community: T.opt(Community, {}),
//   articleTags: T.opt(T.array(Tag), []),

//   // job spec
//   company: T.opt(T.string, ''),
//   companyLink: T.opt(T.string, ''),

//   // showSubTitle: T.opt(T.bool, false),
//   publishing: T.opt(T.bool, false),
//   publishDone: T.opt(T.bool, false),
//   //
//   wordsCountReady: T.opt(T.bool, false),

//   // selectors
//   activeCat: T.opt(T.enum(values(ARTICLE_CAT)), ARTICLE_CAT.FEATURE),

//   activeTag: T.maybeNull(Tag),
// })
//   .views((self) => ({
//     get allowEdit(): boolean {
//       const slf = self as TStore
//       const { mode } = slf

//       if (mode === 'publish') return true

//       return false
//     },
//     get communityId(): TID {
//       return self.community.id
//     },

//     get groupedTags(): TGroupedTags {
//       return []
//       // return root.tagsBar.groupedTags
//     },
//     get texts(): TTexts {
//       return {
//         holder: {
//           title: '// 帖子标题',
//           body: "// 帖子内容（'Tab' 键插入富文本）",
//         },
//       }
//     },
//     get editData(): TEditData {
//       const slf = self as TStore

//       const tagsIds = toJS(slf.articleTags).map((t) => t.id)
//       const baseFields = ['title', 'body', 'copyRight', 'isQuestion', 'linkAddr']

//       // @ts-ignore
//       return { ...pick(baseFields, slf), articleTags: tagsIds }
//     },
//     get isReady(): boolean {
//       const slf = self as TStore
//       const { title, wordsCountReady } = slf
//       const titleReady = title.length > 0

//       return wordsCountReady && titleReady
//     },
//     get isArticleAuthor(): boolean {
//       const slf = self as TStore
//       return slf.allowEdit
//     },
//     get submitState(): TSubmitState {
//       const slf = self as TStore
//       const { mode } = slf

//       const basicStatus = pick(
//         ['publishing', 'publishDone', 'isReady', 'isArchived', 'isArticleAuthor'],
//         slf,
//       )

//       return { ...basicStatus, mode: mode as TEditMode }
//     },
//     get activeTagData(): TTag | null {
//       return toJS(self.activeTag)
//     },
//   }))
//   .actions((self) => ({
//     setViewing(article: TArticle): void {
//       // const thread = article.meta.thread.toLowerCase()

//       // setViewing({ viewingThread: thread, [thread]: article })
//       console.log('## setViewing: ', article)
//     },
//     updateEditing(sobj): void {
//       const slf = self as TStore
//       slf.mark(sobj)
//     },
//     loadEditData(article: TArticle): void {
//       const {
//         title,
//         author,
//         copyRight,
//         linkAddr,
//         isQuestion,
//         document,
//         originalCommunity,
//         articleTags,
//         // @ts-ignore
//         company,
//         // @ts-ignore
//         companyLink,
//         isArchived,
//         archivedAt,
//       } = article

//       self.title = title
//       self.copyRight = copyRight
//       self.isArchived = isArchived
//       self.archivedAt = archivedAt
//       // @ts-ignore
//       self.author = author

//       if (document?.body) self.body = document.body

//       // @ts-ignore
//       if (originalCommunity) self.community = originalCommunity
//       if (linkAddr) self.linkAddr = linkAddr
//       if (isQuestion) self.isQuestion = isQuestion
//       // @ts-ignore
//       if (articleTags) self.articleTags = articleTags

//       if (company) self.company = company
//       if (companyLink) self.companyLink = companyLink
//     },
//     reset(): void {
//       self.mode = 'publish'
//       self.title = ''
//       self.body = '{}'
//       self.linkAddr = ''
//       self.copyRight = 'cc'
//       self.isQuestion = false

//       self.publishing = false
//       self.publishDone = false
//     },
//     mark(sobj: Record<string, unknown>): void {
//       markStates(sobj, self)
//     },
//   }))

// export type TStore = Instance<typeof ArticleEditor>
// // @ts-ignore

// export default ArticleEditor
