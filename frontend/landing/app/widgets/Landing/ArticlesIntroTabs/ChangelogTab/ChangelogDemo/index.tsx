import useSalon from '../../../salon/articles_intro_tabs/changelog_tab/changelog_demo'
import EditorPreview from './EditorPreview'
import EmotionBar from './EmotionBar'
import EmotionBarBad from './EmotionBarBad'
import MainList from './MainList'

export default function ChangelogDemo() {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <MainList />
      <EditorPreview />
      <EmotionBar />
      <EmotionBarBad />
    </div>
  )
}
