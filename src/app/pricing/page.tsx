'use client'

// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const dynamic = 'force-static'

import PriceWall from '~/widgets/PriceWall'

export default () => {
  return <PriceWall />
}
