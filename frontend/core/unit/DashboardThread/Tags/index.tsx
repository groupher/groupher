import { useState } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import TYPE from '~/const/type'
import useTrans from '~/hooks/useTrans'
import type { TChangeMode, TTag } from '~/spec'
import TagSettingEditor from '~/unit/TagSettingEditor'
import Button from '~/widgets/Buttons/Button'
import Drawer from '~/widgets/Drawer'

import useTags from '../logic/useTags'
import Footer from './Footer'
import useSalon from './salon'
import TagList from './TagList'
import ThreadSelector from './ThreadSelector'
import useDraftTag from './useDraftTag'

export default function Tags() {
  const s = useSalon()
  const { t } = useTrans()
  const { activeTagThread, loadTags } = useTags()
  const {
    visibleDraftGroups,
    createDraftGroup,
    renameDraftGroup,
    removeDraftGroup,
    completeDraftGroup,
  } = useDraftTag(activeTagThread)
  const [drawerVisible, setDrawerVisible] = useState(false)
  const [drawerMode, setDrawerMode] = useState<TChangeMode>(CHANGE_MODE.CREATE)

  const openEditTag = (_tag: TTag): void => {
    setDrawerMode(CHANGE_MODE.UPDATE)
    setDrawerVisible(true)
  }

  return (
    <>
      <div className={s.toolbar}>
        <ThreadSelector />
        <div className='grow' />
        <Button ghost noBorder size='small' onClick={() => createDraftGroup(activeTagThread)}>
          {t('dsb.tags.group.add')}
        </Button>
      </div>

      <TagList
        draftGroups={visibleDraftGroups}
        onRemoveDraft={removeDraftGroup}
        onRenameDraft={renameDraftGroup}
        onCompleteDraft={completeDraftGroup}
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
          onDone={() => {
            setDrawerVisible(false)
            loadTags(activeTagThread || undefined)
          }}
        />
      </Drawer>
    </>
  )
}
