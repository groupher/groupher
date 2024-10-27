import DirTree from './DirTree'
import Article from './Article'
import InlineComment from './InlineComment'

import useSalon from '../../../salon/articles_intro_tabs/help_tab/help_demo'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DirTree />
      <Article />
      <InlineComment />
    </div>
  )
}
