// https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config
export const dynamic = 'force-static'

import Landing from './Landing'

export default () => {
  return (
    <>
      <h2>from main repo</h2>
      <Landing />
    </>
  )
}
