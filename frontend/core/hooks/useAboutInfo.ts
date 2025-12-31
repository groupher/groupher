import useDashboard from '~/hooks/useDashboard'
import type { TMediaReport, TSocialItem } from '~/spec'

type TABoutInfo = {
  homepage: string | null
  cities: string[]
  techstacks: string[]
  socialLinks: readonly TSocialItem[]
  mediaReports: readonly TMediaReport[]
}

export default (): TABoutInfo => {
  const dsb$ = useDashboard()

  const { homepage, city, techstack, socialLinks, mediaReports } = dsb$

  return {
    homepage,
    cities: city.split(','),
    techstacks: techstack.split(','),
    socialLinks,
    mediaReports,
  }
}
