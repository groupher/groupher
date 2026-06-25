/* *
 * DocThread
 */

import DocCovers from '~/unit/DocCovers'
import FaqList from '~/unit/FaqList'

import ArticleLayout from './ArticleLayout'
import useSalon from './salon'
import useLogic from './useLogic'

export default function DocThread() {
  const s = useSalon()
  const { isArticleLayout, layout, faqLayout, docFaq, docCoversData } = useLogic()
  // return <ArticleLayout />

  if (isArticleLayout) {
    return <ArticleLayout />
  }

  return (
    <div className={s.wrapper}>
      <DocCovers layout={layout} data={docCoversData} />

      <div className={s.divider} />

      <div className={s.faqs}>
        <FaqList layout={faqLayout} docFaq={docFaq} />
      </div>
    </div>
  )
}
