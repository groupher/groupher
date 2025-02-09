import { type FC, useEffect, useState } from 'react'

import type { TChangeMode, TLinkItem } from '~/spec'

import { CHANGE_MODE } from '~/const/mode'

import MoreSVG from '~/icons/menu/MoreL'
import EditPenSVG from '~/icons/EditPen'
import ArrowSVG from '~/icons/Arrow'

import Tooltip from '~/widgets/Tooltip'
import Linker from '~/widgets/Linker'
import Input from '~/widgets/Input'
import CancelButton from '~/widgets/Buttons/CancelButton'

import { EMPTY_LINK_ITEM } from '../../constant'
import SavingBar from '../../SavingBar'

import LinkMenu from './LinkMenu'

import useFooter from '../../logic/useFooter'
import useSalon, { cn } from '../../salon/footer/editors/link_editor'

type TProps = {
  notifyText?: string
  linkItem?: TLinkItem
  editingLink?: TLinkItem
  isFirst?: boolean
  isLast?: boolean
  mode?: TChangeMode
  disableSetting?: boolean
  disableEdit?: boolean
}

const LinkEditor: FC<TProps> = ({
  notifyText = '',
  linkItem = EMPTY_LINK_ITEM,
  editingLink = null,
  isFirst = false,
  isLast = false,
  mode = CHANGE_MODE.CREATE,
  disableSetting = false,
  disableEdit = false,
}) => {
  const s = useSalon()

  const {
    cancelLinkEditing,
    deleteLink,
    updateEditingLink,
    confirmLinkEditing,
    updateInGroup,
    moveLink,
  } = useFooter()

  const [snapshot, setSnapshot] = useState<TLinkItem | null>(null)
  const editing = linkItem.group === editingLink?.group && linkItem.index === editingLink?.index

  useEffect(() => {
    return () => {
      setSnapshot(null)
    }
  }, [])

  useEffect(() => {
    if (!snapshot && editing && editingLink) {
      setSnapshot(editingLink)
    }
  }, [editing, snapshot, editingLink])

  const isTouched =
    editing &&
    snapshot &&
    (snapshot?.title !== editingLink?.title || snapshot?.link !== editingLink?.link)

  return (
    <div className={cn(s.wrapper, editing && 'w-11/12')}>
      <div className={s.readonly}>
        <div className={s.readonlyHead}>
          {editing && <div className={s.divider} />}
          {!editing && (
            <div className={s.label}>
              {linkItem.title || '--'}
              {notifyText && <div className={s.notifyLabel}>New</div>}
            </div>
          )}
          <div className="grow" />
          <div className={cn(s.actions, editing && '!hidden debug')}>
            {!isFirst && (
              <ArrowSVG
                className={cn(s.icon, 'size-3 rotate-90')}
                onClick={() => moveLink(linkItem, 'up')}
              />
            )}
            {!isLast && (
              <ArrowSVG
                className={cn(s.icon, 'size-3 -rotate-90')}
                onClick={() => moveLink(linkItem, 'down')}
              />
            )}
            {!disableEdit && (
              <EditPenSVG className={s.icon} onClick={() => updateInGroup(linkItem)} />
            )}
            {!disableSetting && (
              <Tooltip
                content={
                  <LinkMenu
                    isFirst={isFirst}
                    isLast={isLast}
                    move2Top={() => moveLink(linkItem, 'top')}
                    move2Bottom={() => moveLink(linkItem, 'bottom')}
                    onDelete={() => deleteLink(linkItem)}
                  />
                }
                placement="bottom-end"
                trigger="click"
                offset={[4, 0]}
                hideOnClick
                noPadding
              >
                <MoreSVG className={s.icon} />
              </Tooltip>
            )}
          </div>
        </div>
        <div className="grow" />
        {!editing && <Linker src={linkItem?.link || ''} left={-2} top={5} external />}
      </div>

      {editing && (
        <div className={s.editWrapper}>
          <div className={s.editTitle}>{mode === CHANGE_MODE.CREATE ? '添加' : '更新'}链接：</div>
          <div className={s.editItem}>
            <Input
              className={s.input}
              value={editingLink?.title || ''}
              placeholder="链接名称"
              onChange={(e) => updateEditingLink('title', e.target.value)}
              autoFocus
            />
          </div>

          <div className={s.editItem}>
            <Input
              className={s.input}
              value={editingLink?.link || ''}
              placeholder="链接地址"
              onChange={(e) => updateEditingLink('link', e.target.value)}
            />
          </div>

          <div className={s.footer}>
            {isTouched ? (
              <SavingBar
                prefix="确认保存"
                onConfirm={confirmLinkEditing}
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
