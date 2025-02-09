import type { TSocialItem, TMediaReport } from '~/spec'

import useSubStore from '~/hooks/useSubStore'

type TABoutInfo = {
  homepage: string | null
  cities: string[]
  techstacks: string[]
  socialLinks: TSocialItem[]
  mediaReports: TMediaReport[]
}

export default (): TABoutInfo => {
  const store = useSubStore('dashboard')

  const { homepage, city, techstack, socialLinks, mediaReports } = store

  return {
    homepage,
    cities: city.split(','),
    techstacks: techstack.split(','),
    socialLinks,
    mediaReports,
  }
}
