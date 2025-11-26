import useDashboard from '~/hooks/useDashboard'
import type { TMediaReport, TSocialItem } from '~/spec'

type TABoutInfo = {
  homepage: string | null
  cities: string[]
  techstacks: string[]
  socialLinks: TSocialItem[]
  mediaReports: TMediaReport[]
}

export default (): TABoutInfo => {
  const store = useDashboard()

  const { homepage, city, techstack, socialLinks, mediaReports } = store

  return {
    homepage,
    cities: city.split(','),
    techstacks: techstack.split(','),
    socialLinks,
    mediaReports,
  }
}
