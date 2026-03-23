import type { TMediaReport, TSocialItem } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

type TABoutInfo = {
  homepage: string | null
  cities: string[]
  techstacks: string[]
  socialLinks: readonly TSocialItem[]
  mediaReports: readonly TMediaReport[]
}

export default function useAboutInfo(): TABoutInfo {
  const dsb$ = useDashboard()

  const { homepage = '', city = '', techstack = '', socialLinks = [], mediaReports = [] } = dsb$

  return {
    homepage: homepage || null,
    cities: city ? city.split(',') : [],
    techstacks: techstack ? techstack.split(',') : [],
    socialLinks,
    mediaReports,
  }
}
