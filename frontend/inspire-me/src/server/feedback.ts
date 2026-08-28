import { createServerFn } from '@tanstack/react-start'

import { getFeedbackPlatform, getFeedbackPlatforms } from '../lib/feedback'
import { makeFeedbackPageData } from '../lib/page'

type FeedbackPageRequest = { platform?: string; page?: string }

/** Loads one SSR-safe feedback page through the Worker Assets binding. */
export const loadFeedbackPage = createServerFn({ method: 'GET', strict: false })
  .validator((data: FeedbackPageRequest) => data)
  .handler(async ({ data }) => {
    const platforms = await getFeedbackPlatforms()
    const platformId = data.platform || platforms[0]?.id
    if (!platformId) return null
    const selected = await getFeedbackPlatform(platformId)
    if (!selected) return null

    return makeFeedbackPageData(platforms, selected, data.page)
  })
