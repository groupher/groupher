import { mockHelpCats } from '~/mock'
import MarkerPicker from '~/widgets/MarkerPicker'

import Category from './Category'
import useSalon from './salon'

export default function BriefCardsLayout() {
  const cats = mockHelpCats()
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className='column mb-8 gap-8'>
        <section className='column gap-4'>
          <h3 className='text-title text-lg'>MarkerPicker</h3>
          <div className='row items-center gap-4'>
            <MarkerPicker />
          </div>
        </section>
      </div>

      <div className={s.groups}>
        {cats.map((cat) => (
          <Category key={cat.id} title={cat.title} articles={cat.articles} />
        ))}
      </div>
    </div>
  )
}
