import type { FC } from 'react'

import { CHANGE_MODE } from '~/const/mode'
import useTrans from '~/hooks/useTrans'
import EditPenSVG from '~/icons/EditPen'
import MoreSVG from '~/icons/menu/MoreL'
import CancelButton from '~/widgets/Buttons/CancelButton'
import Input from '~/widgets/Input'
import Linker from '~/widgets/Linker'
import Tooltip from '~/widgets/Tooltip'

import { EMPTY_LINK_ITEM } from '../constant'
import SavingBar from '../SavingBar'
import DeleteMenu from './DeleteMenu'
import useSalon, { cn } from './salon/link_editor'
import type { TLinkEditorProps } from './spec'
import useLogic from './useLogic'

const LinkEditor: FC<TLinkEditorProps> = ({
  notifyText = '',
  linkItem = EMPTY_LINK_ITEM,
  editingLink = null,
  mode = CHANGE_MODE.CREATE,
  disableSetting = false,
  disableEdit = false,
  compact = false,
  actions,
}) => {
  const s = useSalon()
  const { t } = useTrans()

  const { cancelLinkEditing, deleteLink, confirmLinkEditing, updateInGroup } = {
    ...actions,
  }

  const editing = linkItem.group === editingLink?.group && linkItem.index === editingLink?.index
  const { draft, editingDraft, isTouched, setDraft } = useLogic({ editing, editingLink })

  return (
    <div className={s.wrapper}>
      <div className={cn(s.readonly, compact && s.readonlyCompact)}>
        <div className={s.readonlyHead}>
          {editing && <div className={s.divider} />}
          {!editing && (
            <div className={s.label}>
              {linkItem.title || '--'}
              {notifyText && <div className={s.notifyLabel}>New</div>}
            </div>
          )}
          <div className='grow' />
          <div className={cn(s.actions, editing && '!hidden')}>
            {!disableEdit && (
              <EditPenSVG className={s.icon} onClick={() => updateInGroup(linkItem)} />
            )}
            {!disableSetting && (
              <Tooltip
                content={<DeleteMenu onDelete={() => deleteLink(linkItem)} />}
                placement='bottom-end'
                trigger='click'
                offset={[4, 0]}
                hideOnClick
                noPadding
              >
                <MoreSVG className={s.icon} />
              </Tooltip>
            )}
          </div>
        </div>
        {!compact && <div className='grow' />}
        {!editing && <Linker src={linkItem?.link || ''} left={-1} external />}
      </div>

      {editing && (
        <div className={s.editWrapper}>
          <div className={s.editTitle}>
            {mode === CHANGE_MODE.CREATE
              ? t('dsb.link_editor.add_link')
              : t('dsb.link_editor.update_link')}
          </div>
          <div className={s.editItem}>
            <Input
              className={s.input}
              value={editingDraft?.title || ''}
              placeholder={t('dsb.link_editor.title_placeholder')}
              onChange={(e) =>
                setDraft((item) => (item ? { ...item, title: e.target.value } : item))
              }
              focusOnMount
            />
          </div>

          <div className={s.editItem}>
            <Input
              className={s.input}
              value={editingDraft?.link || ''}
              placeholder={t('dsb.link_editor.url_placeholder')}
              onChange={(e) =>
                setDraft((item) => (item ? { ...item, link: e.target.value } : item))
              }
            />
          </div>

          <div className={s.footer}>
            {isTouched ? (
              <SavingBar
                prefix={t('dsb.link_editor.compact_save_prefix')}
                onConfirm={() => confirmLinkEditing(draft ?? editingLink)}
                onCancel={cancelLinkEditing}
                top={2}
                bottom={2}
                isTouched
                minimal
              />
            ) : (
              <CancelButton onClick={cancelLinkEditing} top={2} />
            )}
          </div>

          {editing && <div className={cn(s.divider, 'mt-4')} />}
        </div>
      )}
    </div>
  )
}

export default LinkEditor
