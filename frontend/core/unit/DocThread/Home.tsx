import DocCovers from '~/unit/DocCovers'
import FaqList from '~/unit/FaqList'

import useSalon from './salon'
import useLogic from './useLogic'

export default function Home() {
  const s = useSalon()
  const { layout, faqLayout, docFaq, docCoversData } = useLogic()

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
