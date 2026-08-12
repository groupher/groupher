import { useNavigate } from '@tanstack/react-router'
import { useSnapshot } from 'valtio'

import { submitApplication } from '../../lib/application'
import { ClientGraphQLError } from '../../lib/graphql'
import { useApplyStore } from '../context'
import { removeDraft } from '../persistence'

export const useApplySubmit = (accountRef: string) => {
  const store = useApplyStore()
  const snapshot = useSnapshot(store)
  const navigate = useNavigate()

  return {
    submitting: snapshot.submitting,
    submitError: snapshot.submitError,
    submit: async () => {
      if (store.submitting) return
      store.submitting = true
      store.submitError = null
      try {
        const application = await submitApplication(
          {
            title: store.title,
            slug: store.slug,
            desc: store.desc,
            logoAssetRef: store.logoAssetRef,
            locale: store.locale,
            applyCategory: store.communityType,
            ...(store.applyMessage.trim() ? { applyMessage: store.applyMessage } : {}),
          },
          store.idempotencyKey,
        )
        store.submittedApplication = application
        removeDraft(accountRef)
        await navigate({ to: `/status/${application.publicRef}` as never })
      } catch (error) {
        store.submitError =
          error instanceof ClientGraphQLError && error.reasonCode
            ? `${error.message} (${error.reasonCode})`
            : error instanceof Error
              ? error.message
              : 'Unable to submit the application.'
      } finally {
        store.submitting = false
      }
    },
  }
}
