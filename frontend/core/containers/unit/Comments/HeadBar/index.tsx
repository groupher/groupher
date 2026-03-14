import { useState, Fragment } from 'react'

import type { TCommentsState } from '~/spec'

import StateBar from './StateBar'
import PublishBar from './PublishBar'
import PublishEditor from '../Editor/PublishEditor'

import { useCommentsHeadState } from '../useLogic'
import useSalon from '../salon/head_bar'

import type { TMode, TAPIMode, TEditState } from '../spec'

export type TProps = {
  mode: TMode
  apiMode: TAPIMode
  isAllFolded: boolean
  loading: boolean
  basicState: TCommentsState
  editState: TEditState
}

export default function HeadBar() {
  const s = useSalon()
  const { mode, apiMode, loading, isAllFolded, basicState, commentBody, submitState } =
    useCommentsHeadState()
  const [barMode, setBarMode] = useState('normal')

  return (
    <div className={s.wrapper}>
      {barMode === 'normal' && (
        <StateBar
          apiMode={apiMode}
          isAllFolded={isAllFolded}
          basicState={basicState}
          mode={mode}
          loading={loading}
          callEditor={() => setBarMode('publish')}
        />
      )}

      {barMode === 'publish' && (
        <Fragment>
          <PublishBar closeEditor={() => setBarMode('normal')} />
          <PublishEditor body={commentBody} submitState={submitState} />
        </Fragment>
      )}
    </div>
  )
}
