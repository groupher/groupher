import {
  ApproveApplicationDocument,
  CancelApplicationDocument,
  RejectApplicationDocument,
  RetryCommunityCreationDocument,
  RetryCommunitySetupDocument,
  StartApplicationReviewDocument,
  SubmitApplicationDocument,
} from '@groupher/frontend-core/graphql/generated'

import type { ApplyCategory } from '../flow/spec'
import type { CommunityApplication } from '../spec'
import { clientGraphQL } from './graphql'

/** Runs the submit application operation at the frontend shared boundary. */
export const submitApplication = async (
  input: {
    title: string
    slug: string
    desc: string
    logoAssetRef: string
    locale: string
    applyCategory: ApplyCategory
    applyMessage?: string
  },
  commandId: string,
): Promise<CommunityApplication> => {
  const result = await clientGraphQL(SubmitApplicationDocument, { input, commandId })
  return result.submitCommunityApplication
}

/** Runs the mutate review application operation at the frontend shared boundary. */
export const mutateReviewApplication = async (
  action: 'start' | 'approve' | 'reject' | 'retry_creation' | 'retry_setup' | 'cancel',
  ref: string,
  expectedVersion: number,
  options: { note?: string; reasonCode?: string } = {},
): Promise<CommunityApplication> => {
  const commandId = crypto.randomUUID()
  const variables = { ref, expectedVersion, commandId }
  switch (action) {
    case 'start':
      return (await clientGraphQL(StartApplicationReviewDocument, variables))
        .startCommunityApplicationReview
    case 'approve':
      return (await clientGraphQL(ApproveApplicationDocument, { ...variables, note: options.note }))
        .approveCommunityApplication
    case 'reject':
      if (!options.reasonCode?.trim()) throw new Error('A rejection reason is required.')
      return (
        await clientGraphQL(RejectApplicationDocument, {
          ...variables,
          note: options.note,
          reasonCode: options.reasonCode,
        })
      ).rejectCommunityApplication
    case 'retry_creation':
      return (await clientGraphQL(RetryCommunityCreationDocument, variables)).retryCommunityCreation
    case 'retry_setup':
      return (await clientGraphQL(RetryCommunitySetupDocument, variables)).retryCommunitySetup
    case 'cancel':
      return (await clientGraphQL(CancelApplicationDocument, variables)).cancelCommunityApplication
  }
}
