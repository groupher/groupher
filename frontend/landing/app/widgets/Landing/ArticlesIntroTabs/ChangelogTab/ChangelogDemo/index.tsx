import MainList from './MainList'
import EditorPreview from './EditorPreview'
import EmotionBar from './EmotionBar'
import EmotionBarBad from './EmotionBarBad'

import useSalon from '../../../salon/articles_intro_tabs/changelog_tab/changelog_demo'

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
