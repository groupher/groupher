import type { FC, SVGProps } from 'react'

import useTrans from '~/hooks/useTrans'
import FolderPlusSVG from '~/icons/FolderPlus'
import ImgUploadSVG from '~/icons/ImgUpload'
import InfoSVG from '~/icons/Info'
import TabsAddSVG from '~/icons/TabsAdd'
import type { TTransKey } from '~/spec'

import useSalon from './salon/workspace_actions'

type TActionKey = 'status' | 'addTab' | 'addGroup' | 'importContent'

type TAction = {
  key: TActionKey
  labelKey: TTransKey
  Icon: FC<SVGProps<SVGSVGElement>>
}

type TProps = {
  onAddGroup: () => void
}

const ACTIONS: TAction[] = [
  {
    key: 'status',
    labelKey: 'dsb.doc.empty_action.status',
    Icon: InfoSVG,
  },
  {
    key: 'addTab',
    labelKey: 'dsb.doc.empty_action.add_tab',
    Icon: TabsAddSVG,
  },
  {
    key: 'addGroup',
    labelKey: 'dsb.doc.empty_action.add_group',
    Icon: FolderPlusSVG,
  },
  {
    key: 'importContent',
    labelKey: 'dsb.doc.empty_action.import_content',
    Icon: ImgUploadSVG,
  },
]

const WorkspaceActions: FC<TProps> = ({ onAddGroup }) => {
  const s = useSalon()
  const { t } = useTrans()

  return (
    <div className={s.wrapper}>
      <div className={s.grid}>
        {ACTIONS.map(({ key, labelKey, Icon }) => {
          const label = t(labelKey)

          return (
            <button
              key={key}
              type='button'
              className={s.card}
              aria-label={label}
              onClick={key === 'addGroup' ? onAddGroup : undefined}
            >
              <Icon className={s.icon} />
              <span className={s.title}>{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default WorkspaceActions
