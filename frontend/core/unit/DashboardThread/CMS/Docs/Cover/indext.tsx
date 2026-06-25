import { type FC, useState } from 'react'

import TYPE from '~/const/type'
import DocCovers from '~/unit/DocCovers'
import type { TDocCoverGroup } from '~/unit/DocCovers/spec'
import Drawer from '~/widgets/Drawer'

import GroupSettingPanel from './GroupSettingPanel'
import useLogic from './useLogic'

const Cover: FC = () => {
  const { community, layout, data } = useLogic()
  const [editingGroup, setEditingGroup] = useState<TDocCoverGroup | null>(null)

  return (
    <>
      <DocCovers layout={layout} data={data} editable onEditGroup={setEditingGroup} />

      <Drawer
        show={Boolean(editingGroup)}
        onClose={() => setEditingGroup(null)}
        type={TYPE.DRAWER.DOC_COVER_GROUP_SETTING}
      >
        {editingGroup && (
          <GroupSettingPanel
            group={editingGroup}
            layout={layout}
            community={community}
            onDone={setEditingGroup}
          />
        )}
      </Drawer>
    </>
  )
}

export default Cover
