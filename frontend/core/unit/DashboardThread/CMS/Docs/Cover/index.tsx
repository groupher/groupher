import { type FC, useEffect, useState } from 'react'

import TYPE from '~/const/type'
import DocCovers from '~/unit/DocCovers'
import type { TDocCoverCard, TDocCoverPinnedDoc } from '~/unit/DocCovers/spec'
import Drawer from '~/widgets/Drawer'
import { toast } from '~/widgets/Toaster'

import GroupSettingPanel from './GroupSettingPanel'
import PinnedDocAppearancePanel from './PinnedDocAppearancePanel'
import PinnedDocsDrawer from './PinnedDocsDrawer'
import useLogic from './useLogic'

const Cover: FC = () => {
  const { community, layout, data, docs, pinDoc, unpinDoc, reorderPinnedDocs, updateAppearance } =
    useLogic()
  const [editingGroup, setEditingGroup] = useState<TDocCoverCard | null>(null)
  const [editingPinnedDoc, setEditingPinnedDoc] = useState<TDocCoverPinnedDoc | null>(null)
  const [addDrawerVisible, setAddDrawerVisible] = useState(false)
  const [busyNodeId, setBusyNodeId] = useState<string | null>(null)
  const [savingAppearance, setSavingAppearance] = useState(false)
  const [pinnedDocs, setPinnedDocs] = useState(data.pinnedDocs)

  useEffect(() => setPinnedDocs(data.pinnedDocs), [data.pinnedDocs])

  const togglePinnedDoc = async (doc: (typeof docs)[number]): Promise<void> => {
    setBusyNodeId(doc.nodeId)
    try {
      if (doc.pinned) await unpinDoc(doc.nodeId)
      else await pinDoc(doc.nodeId)
    } catch {
      toast('Unable to update the pinned doc.')
    } finally {
      setBusyNodeId(null)
    }
  }

  const removePinnedDoc = async (doc: TDocCoverPinnedDoc): Promise<void> => {
    setPinnedDocs((current) => current.filter((item) => item.nodeId !== doc.nodeId))
    try {
      await unpinDoc(doc.nodeId)
    } catch {
      setPinnedDocs(data.pinnedDocs)
      toast('Unable to unpin this doc.')
    }
  }

  const reorder = async (nextDocs: readonly TDocCoverPinnedDoc[]): Promise<void> => {
    setPinnedDocs(nextDocs)
    try {
      await reorderPinnedDocs(nextDocs)
    } catch {
      setPinnedDocs(data.pinnedDocs)
      toast('Unable to save the pinned doc order.')
    }
  }

  return (
    <>
      <DocCovers
        layout={layout}
        data={{ ...data, pinnedDocs }}
        editable
        onEditCard={setEditingGroup}
        onAddPinnedDoc={() => setAddDrawerVisible(true)}
        onEditPinnedDoc={setEditingPinnedDoc}
        onUnpinDoc={removePinnedDoc}
        onReorderPinnedDocs={reorder}
      />

      <Drawer
        show={Boolean(editingGroup)}
        onClose={() => setEditingGroup(null)}
        type={TYPE.DRAWER.DOC_COVER_GROUP_SETTING}
      >
        {editingGroup && (
          <GroupSettingPanel
            section={editingGroup}
            layout={layout}
            community={community}
            onDone={setEditingGroup}
          />
        )}
      </Drawer>

      <Drawer
        show={addDrawerVisible}
        onClose={() => setAddDrawerVisible(false)}
        type={TYPE.DRAWER.DOC_COVER_GROUP_SETTING}
      >
        <PinnedDocsDrawer docs={docs} busyNodeId={busyNodeId} onToggle={togglePinnedDoc} />
      </Drawer>

      <Drawer
        show={Boolean(editingPinnedDoc)}
        onClose={() => setEditingPinnedDoc(null)}
        type={TYPE.DRAWER.DOC_COVER_GROUP_SETTING}
      >
        {editingPinnedDoc && (
          <PinnedDocAppearancePanel
            key={editingPinnedDoc.nodeId}
            doc={editingPinnedDoc}
            saving={savingAppearance}
            onSave={async (appearance) => {
              setSavingAppearance(true)
              try {
                await updateAppearance(editingPinnedDoc.nodeId, appearance)
                setEditingPinnedDoc({ ...editingPinnedDoc, appearance })
                toast('Pinned doc appearance saved.')
              } catch {
                toast('Unable to save the pinned doc appearance.')
              } finally {
                setSavingAppearance(false)
              }
            }}
          />
        )}
      </Drawer>
    </>
  )
}

export default Cover
