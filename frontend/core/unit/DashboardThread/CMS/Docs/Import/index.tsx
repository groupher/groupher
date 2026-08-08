'use client'

import { useEffect } from 'react'

import useTrans from '~/hooks/useTrans'
import useCommunity from '~/stores/community/hooks'
import Button from '~/ui/Buttons/Button'
import { registerBeforeDashboardBack } from '~/unit/DashboardThread/SideMenu/beforeBack'

import AnalyzingStep from './AnalyzingStep'
import CompletedStep from './CompletedStep'
import { PHASE } from './constant'
import ImportingStep from './ImportingStep'
import ImportIssues from './ImportIssues'
import RepoStep from './RepoStep'
import ReviewStep from './ReviewStep'
import useSalon from './salon'
import Stepper from './Stepper'
import useLogic from './useLogic'

/**
 * Renders the Docs bulk-import phase selected by the recoverable client controller.
 *
 * @see docs/bulk-import/bulk-import.md
 */
export default function DocumentImport() {
  const s = useSalon()
  const { t } = useTrans()
  const { slug: community } = useCommunity()
  const logic = useLogic()
  const issues = logic.job ? [...logic.job.failedItems, ...logic.job.skipped] : []

  useEffect(() => registerBeforeDashboardBack(logic.reset), [logic.reset])

  return (
    <section className={s.wrapper}>
      <header className={s.intro}>
        <h1 className={s.title}>{t('dsb.doc.bulk_import.title')}</h1>
        <p className={s.description}>{t('dsb.doc.bulk_import.desc')}</p>
      </header>

      <Stepper phase={logic.phase} />

      {logic.phase === PHASE.REPO && <RepoStep {...logic} />}
      {logic.phase === PHASE.ANALYZING && logic.process ? (
        <AnalyzingStep
          disconnected={logic.pollingDisconnected}
          process={logic.process}
          repoUrl={logic.repoUrl}
        />
      ) : null}
      {logic.phase === PHASE.REVIEW && logic.preview && (
        <ReviewStep apply={logic.apply} preview={logic.preview} reset={logic.reset} />
      )}
      {logic.phase === PHASE.IMPORTING && logic.process ? (
        <ImportingStep disconnected={logic.pollingDisconnected} process={logic.process} />
      ) : null}
      {logic.phase === PHASE.COMPLETED && logic.job && (
        <CompletedStep community={community} job={logic.job} reset={logic.reset} />
      )}
      {logic.phase === PHASE.FAILED && (
        <div className={s.failureCard} role='alert'>
          <p className={s.error}>{logic.error || logic.job?.errorMessage}</p>
          <ImportIssues issues={issues} />
          <Button ghost onClick={logic.reset}>
            {t('dsb.doc.bulk_import.failed.change')}
          </Button>
        </div>
      )}
    </section>
  )
}
