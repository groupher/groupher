import type { FC } from 'react'
import { COLOR_NAME } from '~/const/colors'
import TagNode from '~/widgets/TagNode'
import useSalon, {
  cn,
} from '../../../../salon/articles_intro_tabs/changelog_tab/changelog_demo/editor_preview'
import CoverPreview from '../CoverPreview'
import Toolbox from './Toolbox'

const EditorPreview: FC = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.header}>
        <div className={s.title}>
          船新封面图编辑器2 <div className={s.version}>v2.0</div>
        </div>

        <div className={s.tags}>
          <div className={s.tagItem}>
            <TagNode color={COLOR_NAME.GREEN} boldHash />
            Web
          </div>

          <div className={s.tagItem}>
            <TagNode color={COLOR_NAME.ORANGE} boldHash />
            Mobile
          </div>
        </div>
      </div>
      <div className={s.cover}>
        <CoverPreview />
      </div>
      <Toolbox />

      <div className={s.content}>
        <div className={cn(s.bar)} />
        <div className={cn(s.bar, 'w-32 opacity-20')} />
        <div className={cn(s.bar, 'w-20 opacity-15')} />
      </div>
    </div>
  )
}

export default EditorPreview
