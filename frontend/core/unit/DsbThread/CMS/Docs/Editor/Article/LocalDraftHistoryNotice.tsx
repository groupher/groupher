import type { FC } from 'react'

import type { TLocalDraftHistoryController } from './hooks/useLocalDraftHistory'

type TProps = {
  controller: TLocalDraftHistoryController
}

/**
 * Presents explicit local recovery choices without automatically replacing the
 * freshly loaded server Draft.
 *
 *   inspection -> user choice -> restore or discard
 */
const LocalDraftHistoryNotice: FC<TProps> = ({ controller }) => {
  const { availability, inspection, recoveryPoints } = controller
  if (!availability.available) {
    return <div role='status'>Local draft recovery is unavailable on this browser.</div>
  }
  if (inspection.status === 'none' && recoveryPoints.length === 0) return null

  return (
    <section aria-label='Local draft history'>
      {inspection.status !== 'none' && (
        <div role='alert'>
          <span>
            {inspection.status === 'divergent'
              ? 'A local draft and the server draft both changed.'
              : 'Unsaved local changes are available.'}
          </span>
          <button type='button' onClick={controller.restoreWorkingCopy}>
            Restore local copy
          </button>
          <button type='button' onClick={() => void controller.discardWorkingCopy()}>
            Discard local copy
          </button>
          <button type='button' onClick={controller.dismiss}>
            Later
          </button>
        </div>
      )}
      {recoveryPoints.length > 0 && (
        <details>
          <summary>Local history ({recoveryPoints.length})</summary>
          <ul>
            {recoveryPoints.map((point) => (
              <li key={point.id}>
                <time dateTime={new Date(point.createdAt).toISOString()}>
                  {new Date(point.createdAt).toLocaleString()}
                </time>
                <button type='button' onClick={() => controller.restoreRecoveryPoint(point)}>
                  Restore
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}

export default LocalDraftHistoryNotice
