import { DEME_SOCIALS } from '~/const/social'
import { THREAD } from '~/const/thread'
import useEnable from '~/hooks/useEnable'
import useViewingThread from '~/hooks/useViewingThread'

import { refreshArticles } from '~/signal'
import FileTree from '~/unit/doc-thread/FileTree'
import PinedTree from '~/unit/doc-thread/PinedTree'
import SocialList from '~/unit/social-list'
import TagsBar from '~/unit/tags-bar'
import AccountUnit from '~/widgets/AccountUnit'
import Sticky from '~/widgets/Sticky'
import useSalon, { cn } from '../salon/sidebar_layout'
import CommunityBrief from './CommunityBrief'
import MainMenu from './MainMenu'

export default function SidebarLayout() {
  const s = useSalon()

  const activeThread = useViewingThread()
  const enable = useEnable()

  return (
    <div className={s.wrapper}>
      <Sticky>
        <div className={s.innerWrapper}>
          <CommunityBrief />
          <div className={cn(s.divider, 'mt-5 mb-2')} />
          {activeThread !== THREAD.DOC && (
            <>
              <MainMenu />
              <div className={cn(s.divider, 'mt-4 mb-5')} />
            </>
          )}

          {activeThread === THREAD.POST && enable.post && (
            <>
              <div className={s.tabs}>
                <TagsBar onSelect={() => refreshArticles()} />
              </div>
              <div className={cn(s.divider, 'mt-4 mb-2')} />
            </>
          )}

          {activeThread === THREAD.DOC && enable.doc && (
            <div className={s.fileTree}>
              <PinedTree />
              <FileTree />
            </div>
          )}

          <SocialList top={20} left={-10} size='tiny' selected={DEME_SOCIALS} />
          <AccountUnit top={5} withName />
        </div>
      </Sticky>
    </div>
  )
}
