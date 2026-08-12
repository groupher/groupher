import { Link, createFileRoute, redirect } from '@tanstack/react-router'

import ApplyFlow from '../components/ApplyFlow'
import LoginRequired from '../components/LoginRequired'
import ApplyFlowProvider from '../flow/provider'
import { loadApplyState } from '../server/application'

export const Route = createFileRoute('/')({
  loader: async () => {
    const state = await loadApplyState()
    if (state.currentApplication) {
      throw redirect({
        to: `/status/${state.currentApplication.publicRef}` as never,
      })
    }
    return state
  },
  component: ApplyIndex,
})

function ApplyIndex() {
  const state = Route.useLoaderData()
  if (!state.account) return <LoginRequired />

  if (!state.canApply.allowed) {
    return (
      <section className='apply-card'>
        <h1 className='apply-title'>Application unavailable</h1>
        <p className='apply-copy'>Reason: {state.canApply.reasonCode || 'apply_not_allowed'}</p>
      </section>
    )
  }

  return (
    <>
      {state.latestFailedApplication ? (
        <div className='apply-notice'>
          Your recent application for “{state.latestFailedApplication.title}” needs attention.{' '}
          <Link to={`/status/${state.latestFailedApplication.publicRef}` as never}>
            View status
          </Link>
        </div>
      ) : null}
      <ApplyFlowProvider accountRef={state.account.publicRef}>
        <ApplyFlow accountRef={state.account.publicRef} />
      </ApplyFlowProvider>
    </>
  )
}
