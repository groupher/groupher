import { equals, filter, find, isEmpty, mergeRight, reject, startsWith } from 'ramda'
import useGraphQLClient from '~/hooks/useGraphQLClient'
import type { TMediaReport } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import { EMPTY_MEDIA_REPORT } from '../../constant'

import S from '../../schema'

export type TRet = {
  queryingMediaReportIndex: number | null

  mediaReports: TMediaReport[]
  isMediaReportsTouched: boolean

  addMediaReport: () => void
  mediaReportOnChange: (index: number, url: string) => void
  removeMediaReport: (index: number) => void
  queryOpenGraphInfo: (item: TMediaReport) => void
}

export default function useMediaReports(): TRet {
  const dsb$ = useDashboard()

  const { mediaReports, original, queryingMediaReportIndex } = dsb$

  const { query } = useGraphQLClient()

  const mediaReportsTouched = () => {
    const curValues = reject((item: TMediaReport) => !item.editUrl, mediaReports)
    const initValues = reject((item: TMediaReport) => !item.editUrl, original.mediaReports)

    const curValueTitles = filter((item: TMediaReport) => !isEmpty(item?.title), curValues)
    const isCurAllValid = curValueTitles.length !== 0 && curValueTitles.length === curValues.length

    return isCurAllValid && !equals(curValues, initValues)
  }

  const addMediaReport = (): void => {
    const { mediaReports } = dsb$
    const newReport = mergeRight(EMPTY_MEDIA_REPORT, { index: Date.now() })

    dsb$.commit({ mediaReports: [...mediaReports, newReport] })
  }

  const mediaReportOnChange = (index: number, url: string): void => {
    const { mediaReports } = dsb$
    const restReports = reject((item: TMediaReport) => item.index === index, mediaReports)
    const report = find((item: TMediaReport) => item.index === index, mediaReports)

    report.editUrl = url

    dsb$.commit({ mediaReports: [...restReports, report] })
  }

  const removeMediaReport = (index: number): void => {
    const { mediaReports } = dsb$
    const newReports = reject((item: TMediaReport) => item.index === index, mediaReports)

    dsb$.commit({ mediaReports: newReports })
  }

  const handleOgQueryInfo = (data) => {
    const { queryingMediaReportIndex, mediaReports } = dsb$

    const restReports = reject(
      (item: TMediaReport) => item.index === queryingMediaReportIndex,
      mediaReports,
    )
    const report = find(
      (item: TMediaReport) => item.index === queryingMediaReportIndex,
      mediaReports,
    )
    const updatedReport = mergeRight(report, data)

    dsb$.commit({
      queryingMediaReportIndex: null,
      loading: false,
      mediaReports: [...restReports, updatedReport],
    })
  }

  const queryOpenGraphInfo = (item: TMediaReport): void => {
    const { url, editUrl } = item

    if ((startsWith('https://', editUrl) || startsWith('http://', editUrl)) && url !== editUrl) {
      dsb$.commit({ loading: true, queryingMediaReportIndex: item.index })

      const params = { url: editUrl.trim() }
      query(S.openGraphInfo, params)
        .then(({ openGraphInfo }) => handleOgQueryInfo(openGraphInfo))
        .catch((e) => {
          dsb$.commit({ loading: false, queryingMediaReportIndex: null })
          console.error('## og info: ', e)
          // biome-ignore lint/suspicious/noAlert: <explanation>
          alert('## queryOpenGraphInfo error')
        })
    }
  }

  return {
    queryingMediaReportIndex,
    // @ts-expect-error
    mediaReports,
    isMediaReportsTouched: mediaReportsTouched(),
    addMediaReport,
    mediaReportOnChange,
    removeMediaReport,
    queryOpenGraphInfo,
  }
}
