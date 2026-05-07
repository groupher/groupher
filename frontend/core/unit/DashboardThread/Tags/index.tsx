import { useState } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import { THREAD } from '~/const/thread'
import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import type { TChangeMode, TTag } from '~/spec'
import TagSettingEditor from '~/unit/TagSettingEditor'
import Button from '~/widgets/Buttons/Button'
import Drawer from '~/widgets/Drawer'

import useTags from '../logic/useTags'
import useSalon from '../salon/tags'
import Footer from './Footer'
import TagList from './TagList'
import ThreadSelector from './ThreadSelector'
import type { TDraftGroup } from './types'

export default function Tags() {
  const s = useSalon()
  const { t } = useTrans()
  const { activeTagThread, loadTags } = useTags()
  const [draftGroups, setDraftGroups] = useState<TDraftGroup[]>([])
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<TChangeMode>(CHANGE_MODE.CREATE)
  const [drawerGroup, setDrawerGroup] = useState('')

  const openCreateTag = (group = ''): void => {
    setDrawerMode(CHANGE_MODE.CREATE)
    setDrawerGroup(group)
    setDrawerVisible(true)
  }

  const openEditTag = (_tag: TTag): void => {
    setDrawerMode(CHANGE_MODE.UPDATE)
    setDrawerGroup('')
    setDrawerVisible(true)
  }

  const createDraftGroup = (): void => {
    setDraftGroups((groups) => [
      {
        id: `${Date.now()}`,
        title: '',
        thread: activeTagThread || THREAD.POST,
      },
      ...groups,
    ])
  }

  const renameDraftGroup = (draftId: string, toGroup: string): void => {
    setDraftGroups((groups) =>
      groups.map((group) => (group.id === draftId ? { ...group, title: toGroup } : group)),
    )
  }

  const removeDraftGroup = (draftId: string): void => {
    setDraftGroups((groups) => groups.filter((item) => item.id !== draftId))
  }

  const removeDraftGroupByTitle = (title: string): void => {
    setDraftGroups((groups) => groups.filter((group) => group.title !== title))
  }

  return (
    <>
      <div className={s.toolbar}>
        <ThreadSelector />
        <div className='grow' />
        <Button ghost noBorder size='small' onClick={createDraftGroup}>
          {t('dsb.tags.group.add')}
        </Button>
      </div>

      <TagList
        draftGroups={draftGroups}
        onCreateTag={openCreateTag}
        onRemoveDraft={removeDraftGroup}
        onRenameDraft={renameDraftGroup}
        onSettingTag={openEditTag}
      />

      <Footer />

      <Drawer
        show={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        type={TYPE.DRAWER.EDIT_TAG}
      >
        <TagSettingEditor
          mode={drawerMode}
          initialGroup={drawerGroup}
          onDone={() => {
            setDrawerVisible(false)
            loadTags(activeTagThread || undefined)
            removeDraftGroupByTitle(drawerGroup)
          }}
        />
      </Drawer>
    </>
  )
}
