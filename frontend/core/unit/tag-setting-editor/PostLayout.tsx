import { type FC, memo } from 'react'
import { POST_LAYOUT } from '~/const/layout'
import type { TPostLayout } from '~/spec'

import CheckLabel from '~/widgets/CheckLabel'

import useSalon, { cn } from './salon/post_layout'

type TProps = {
  layout: string
  onChange: (layout: TPostLayout) => void
}

const PostListLayout: FC<TProps> = ({ layout, onChange }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.layout} onClick={() => onChange(POST_LAYOUT.QUORA)}>
        <div className={cn(s.block, layout === POST_LAYOUT.QUORA && s.blockActive)}>
          <h3>QUORA</h3>
        </div>
        <CheckLabel title='经典' active={layout === POST_LAYOUT.QUORA} top={4} />
      </div>
      <div className={s.layout} onClick={() => onChange(POST_LAYOUT.PH)}>
        <div className={cn(s.block, layout === POST_LAYOUT.PH && s.blockActive)}>
          <h3>PH</h3>
        </div>
        <CheckLabel title='三段式' active={layout === POST_LAYOUT.PH} top={4} />
      </div>

      <div className={s.layout} onClick={() => onChange(POST_LAYOUT.MASONRY)}>
        <div className={cn(s.block, layout === POST_LAYOUT.MASONRY && s.blockActive)}>
          <h3>MASONRY</h3>
        </div>
        <CheckLabel title='瀑布流卡片' $active={layout === POST_LAYOUT.MASONRY} top={4} />
      </div>

      <div className={s.layout} onClick={() => onChange(POST_LAYOUT.MINIMAL)}>
        <div className={cn(s.block, layout === POST_LAYOUT.MINIMAL && s.blockActive)}>
          <h3>MINIMAL</h3>
        </div>
        <CheckLabel title='极简' active={layout === POST_LAYOUT.MINIMAL} top={4} />
      </div>

      <div className={s.layout} onClick={() => onChange(POST_LAYOUT.COVER)}>
        <div className={cn(s.block, layout === POST_LAYOUT.COVER && s.blockActive)}>
          <h3>COVER</h3>
        </div>
        <CheckLabel title='封面图' active={layout === POST_LAYOUT.COVER} top={4} />
      </div>
    </div>
  )
}

export default memo(PostListLayout)
