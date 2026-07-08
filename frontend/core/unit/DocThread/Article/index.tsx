import FeedbackFooter from '../FeedbackFooter'
import Body from './Body'
import Header from './Header'
import useSalon from './salon'

export default function Article() {
  const s = useSalon()

  return (
    <article className={s.wrapper}>
      <Header />
      <Body />
      <FeedbackFooter top={16} offsetRight={0} />
    </article>
  )
}
