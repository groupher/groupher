import { isEmpty, find, reject, filter, equals, mergeRight, startsWith } from 'ramda'

import type { TMediaReport } from '~/spec'
import { query } from '~/server'

import useSubStore from '~/hooks/useSubStore'

import { EMPTY_MEDIA_REPORT } from '../../constant'

import S from '../../schema'

export type TRet = {
  queringMediaReportIndex: number | null

  mediaReports: TMediaReport[]
  isMediaReportsTouched: boolean

  addMediaReport: () => void
  mediaReportOnChange: (index: number, url: string) => void
  removeMediaReport: (index: number) => void
  queryOpenGraphInfo: (item: TMediaReport) => void
}

export default (): TRet => {
  const store = useSubStore('dashboard')

  const { mediaReports, original, queringMediaReportIndex } = store

  const mediaReportsTouched = () => {
    const curValues = reject((item: TMediaReport) => !item.editUrl, mediaReports)
    const initValues = reject((item: TMediaReport) => !item.editUrl, original.mediaReports)

    const curValueTitles = filter((item: TMediaReport) => !isEmpty(item?.title), curValues)
    const isCurAllvalid = curValueTitles.length !== 0 && curValueTitles.length === curValues.length

    return isCurAllvalid && !equals(curValues, initValues)
  }

  const addMediaReport = (): void => {
    const { mediaReports } = store
    const newReport = mergeRight(EMPTY_MEDIA_REPORT, { index: new Date().getTime() })

    store.mediaReports = [...mediaReports, newReport]
  }

  const mediaReportOnChange = (index: number, url: string): void => {
    const { mediaReports } = store

    const restReports = reject((item: TMediaReport) => item.index === index, mediaReports)
    const report = find((item: TMediaReport) => item.index === index, mediaReports)

    report.editUrl = url

    store.mediaReports = [...restReports, report]
  }

  const removeMediaReport = (index: number): void => {
    const { mediaReports } = store
    const newReports = reject((item: TMediaReport) => item.index === index, mediaReports)

    store.commit({ mediaReports: newReports })
  }

  const handleOgQueryInfo = (data) => {
    const { queringMediaReportIndex, mediaReports } = store

    const restReports = reject(
      (item: TMediaReport) => item.index === queringMediaReportIndex,
      mediaReports,
    )
    const report = find(
      (item: TMediaReport) => item.index === queringMediaReportIndex,
      mediaReports,
    )
    const updatedReport = mergeRight(report, data)

    store.commit({
      queringMediaReportIndex: null,
      loading: false,
      mediaReports: [...restReports, updatedReport],
    })
  }

  const queryOpenGraphInfo = (item: TMediaReport): void => {
    const { url, editUrl } = item

    if ((startsWith('https://', editUrl) || startsWith('http://', editUrl)) && url !== editUrl) {
      store.queringMediaReportIndex = item.index
      store.loading = true

      const params = { url: editUrl.trim() }
      query(S.openGraphInfo, params)
        .then(({ openGraphInfo }) => handleOgQueryInfo(openGraphInfo))
        .catch((e) => {
          store.loading = false
          store.queringMediaReportIndex = null
          console.error('## og info: ', e)
          alert('## queryOpenGraphInfo error')
        })
    }
  }

  return {
    queringMediaReportIndex,
    mediaReports,
    isMediaReportsTouched: mediaReportsTouched(),
    addMediaReport,
    mediaReportOnChange,
    removeMediaReport,
    queryOpenGraphInfo,
  }
}
