import { equals, filter, find, isEmpty, mergeRight, reject, startsWith } from 'ramda'
import useDashboard from '~/hooks/useDashboard'
import { query } from '~/server'
import type { TMediaReport } from '~/spec'

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

export default (): TRet => {
  const store = useDashboard()

  const { mediaReports, original, queryingMediaReportIndex } = store

  const mediaReportsTouched = () => {
    const curValues = reject((item: TMediaReport) => !item.editUrl, mediaReports)
    const initValues = reject((item: TMediaReport) => !item.editUrl, original.mediaReports)

    const curValueTitles = filter((item: TMediaReport) => !isEmpty(item?.title), curValues)
    const isCurAllValid = curValueTitles.length !== 0 && curValueTitles.length === curValues.length

    return isCurAllValid && !equals(curValues, initValues)
  }

  const addMediaReport = (): void => {
    const { mediaReports } = store
    const newReport = mergeRight(EMPTY_MEDIA_REPORT, { index: Date.now() })

    store.mediaReports = [...mediaReports, newReport]
  }

  const mediaReportOnChange = (index: number, url: string): void => {
    const { mediaReports } = store

    const restReports = reject((item: TMediaReport) => item.index === index, mediaReports)
    const report = find((item: TMediaReport) => item.index === index, mediaReports)

    // @ts-expect-error
    report.editUrl = url

    store.mediaReports = [...restReports, report]
  }

  const removeMediaReport = (index: number): void => {
    const { mediaReports } = store
    const newReports = reject((item: TMediaReport) => item.index === index, mediaReports)

    store.commit({ mediaReports: newReports })
  }

  const handleOgQueryInfo = (data) => {
    const { queryingMediaReportIndex, mediaReports } = store

    const restReports = reject(
      (item: TMediaReport) => item.index === queryingMediaReportIndex,
      mediaReports,
    )
    const report = find(
      (item: TMediaReport) => item.index === queryingMediaReportIndex,
      mediaReports,
    )
    const updatedReport = mergeRight(report, data)

    store.commit({
      queryingMediaReportIndex: null,
      loading: false,
      mediaReports: [...restReports, updatedReport],
    })
  }

  const queryOpenGraphInfo = (item: TMediaReport): void => {
    const { url, editUrl } = item

    if ((startsWith('https://', editUrl) || startsWith('http://', editUrl)) && url !== editUrl) {
      store.queryingMediaReportIndex = item.index
      store.loading = true

      const params = { url: editUrl.trim() }
      query(S.openGraphInfo, params)
        .then(({ openGraphInfo }) => handleOgQueryInfo(openGraphInfo))
        .catch((e) => {
          store.loading = false
          store.queryingMediaReportIndex = null
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
