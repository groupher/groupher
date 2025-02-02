// /*
//  * ArticleViewer store
//  */

// const ArticleViewer = T.model('ArticleViewer', {
//   loading: T.opt(T.bool, false),
//   tab: T.opt(T.string, ''),
//   // blog-spec
//   document: T.opt(Document, {}),
// }).actions((self) => ({
//   setViewing(sobj): void {
//     root.setViewing(sobj)
//   },
//   syncArticle(item): void {
//     console.log('## TODO: syncArticle')
//     // root.articles.updateArticle(item)
//   },
//   reset(): void {
//     self.tab = ''
//   },
//   mark(sobj: Record<string, unknown>): void {
//     markStates(sobj, self)
//   },
// }))

// export type TStore = Instance<typeof ArticleViewer>
// // @ts-ignore

// export default ArticleViewer
