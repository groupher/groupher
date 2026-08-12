import type { CommunityApplication } from '../spec'
import { clientGraphQL } from './graphql'

export const submitApplication = async (
  input: {
    title: string
    slug: string
    desc: string
    logoAssetRef: string
    locale: string
    applyCategory: string
    applyMessage?: string
  },
  idempotencyKey: string,
): Promise<CommunityApplication> => {
  const result = await clientGraphQL<{ submitCommunityApplication: CommunityApplication }>(
    `mutation SubmitApplication($input: CommunityApplicationInput!, $idempotencyKey: String!) {
      submitCommunityApplication(input: $input, idempotencyKey: $idempotencyKey) {
        publicRef status version title slug desc submittedAt updatedAt
        logo { applicationUploadRef communityAssetRef url }
      }
    }`,
    { input, idempotencyKey },
  )
  return result.submitCommunityApplication
}

export const mutateReviewApplication = async (
  action: 'start' | 'approve' | 'reject' | 'retry_creation' | 'retry_setup' | 'cancel',
  ref: string,
  expectedVersion: number,
  options: { note?: string; reasonCode?: string } = {},
): Promise<CommunityApplication> => {
  const definitions = {
    start: ['startCommunityApplicationReview', ''],
    approve: ['approveCommunityApplication', ', note: $note'],
    reject: ['rejectCommunityApplication', ', reasonCode: $reasonCode, note: $note'],
    retry_creation: ['retryCommunityCreation', ''],
    retry_setup: ['retryCommunitySetup', ''],
    cancel: ['cancelCommunityApplication', ''],
  } as const
  const [field, extra] = definitions[action]
  const result = await clientGraphQL<Record<string, CommunityApplication>>(
    `mutation ApplicationAction($ref: ID!, $expectedVersion: Int!, $note: String, $reasonCode: String) {
      ${field}(ref: $ref, expectedVersion: $expectedVersion${extra}) {
        publicRef status version title slug updatedAt
      }
    }`,
    { ref, expectedVersion, note: options.note, reasonCode: options.reasonCode },
  )
  return result[field]
}
