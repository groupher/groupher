import type { TDocPublicTree } from '~/spec'

import FeedbackFooter from '../FeedbackFooter'
import Body from './Body'
import Header from './Header'
import useSalon from './salon'

type TProps = {
  tree: TDocPublicTree
}

export default function Article({ tree }: TProps) {
  const s = useSalon()

  return (
    <article className={s.wrapper}>
      <Header tree={tree} />
      <Body />
      <FeedbackFooter top={16} offsetRight={0} />
    </article>
  )
}
