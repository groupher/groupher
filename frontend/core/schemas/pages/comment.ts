import commentsSchema from '../../unit/Comments/schema'

// The page registry keeps the same typed document used by the Comments feature.
// This avoids creating a second operation definition for the identical contract.
export const pagedComments = commentsSchema.pagedComments
