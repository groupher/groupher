import { type FC, memo } from 'react'

import EditPenSVG from '~/icons/EditPen'
import Button from '~/widgets/Buttons/Button'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import SortMenu from './SortMenu'
import type { TProps as TBase } from '..'

import useSalon from '../../salon/head_bar/state_bar'

type TProps = Pick<TBase, 'mode' | 'apiMode' | 'isAllFolded' | 'loading' | 'basicState'> & {
  callEditor?: () => void
}

const StateBar: FC<TProps> = ({
  basicState,
  mode,
  isAllFolded,
  loading,
  apiMode,
  callEditor = console.log,
}) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.totalCount}>
        <div className={s.totalTitle}>
          评论
          <div className={s.totalNum}>{basicState.totalCount}</div>
        </div>
      </div>
      <div className={s.actions}>
        {loading && <LavaLampLoading right={15} />}

        <SortMenu mode={mode} isAllFolded={isAllFolded} apiMode={apiMode} />
        <Button size="small" space={2.5} onClick={() => callEditor()}>
          <EditPenSVG className={s.editIcon} />
          写评论
        </Button>
      </div>
    </div>
  )
}

export default memo(StateBar)
