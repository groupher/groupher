import useSalon from '../../../salon/articles_intro_tabs/help_tab/help_demo'
import Article from './Article'
import DirTree from './DirTree'
import InlineComment from './InlineComment'

export default function HelpDemo() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <DirTree />
      <Article />
      <InlineComment />
    </div>
  )
}
