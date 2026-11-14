import { equals, filter, find, isEmpty, mergeRight, reject, startsWith } from 'ramda'
import { useRef, useState } from 'react'

import { browserGraphQLRequest } from '~/graphql/client'
import type { TMediaReport } from '~/spec'
import useDsbShell, { useDsbShellStore } from '~/stores/dsbShell/hooks'
import S from '~/unit/DsbThread/schema/integrations'

import { EMPTY_MEDIA_REPORT } from '../../constant'

export type TRet = {
  queryingMediaReportIndex: number | null

  mediaReports: TMediaReport[]
  isMediaReportsTouched: boolean

  addMediaReport: () => void
  mediaReportOnChange: (index: number, url: string) => void
  removeMediaReport: (index: number) => void
  queryOpenGraphInfo: (item: TMediaReport) => void
}

/** Exposes media reports state and actions through the shared React hook boundary. */
export default function useMediaReports(): TRet {
  const dsb$ = useDsbShell()
  const dsbStore = useDsbShellStore()

  const { mediaReports, original } = dsb$
  const [queryingMediaReportIndex, setQueryingMediaReportIndex] = useState<number | null>(null)
  const queryingMediaReportIndexRef = useRef<number | null>(null)

  const setQueryingMediaReportIndexSafe = (index: number | null): void => {
    queryingMediaReportIndexRef.current = index
    setQueryingMediaReportIndex(index)
  }

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

    dsb$.editMany({ mediaReports: [...mediaReports, newReport] })
  }

  const mediaReportOnChange = (index: number, url: string): void => {
    const { mediaReports } = dsb$
    const restReports = reject((item: TMediaReport) => item.index === index, mediaReports)
    const report = find((item: TMediaReport) => item.index === index, mediaReports)

    if (!report) return

    report.editUrl = url

    dsb$.editMany({ mediaReports: [...restReports, report] })
  }

  const removeMediaReport = (index: number): void => {
    const { mediaReports } = dsb$
    const newReports = reject((item: TMediaReport) => item.index === index, mediaReports)

    dsb$.editMany({ mediaReports: newReports })
  }

  const handleOgQueryInfo = (data) => {
    const { mediaReports } = dsbStore
    const queryingMediaReportIndex = queryingMediaReportIndexRef.current

    const restReports = reject(
      (item: TMediaReport) => item.index === queryingMediaReportIndex,
      mediaReports,
    )
    const report = find(
      (item: TMediaReport) => item.index === queryingMediaReportIndex,
      mediaReports,
    )
    if (!report) return
    const updatedReport = mergeRight(report, data)

    setQueryingMediaReportIndexSafe(null)
    dsbStore.edit('mediaReports', [...restReports, updatedReport])
  }

  const queryOpenGraphInfo = (item: TMediaReport): void => {
    const { url, editUrl } = item

    if (
      editUrl &&
      (startsWith('https://', editUrl) || startsWith('http://', editUrl)) &&
      url !== editUrl
    ) {
      setQueryingMediaReportIndexSafe(item.index)

      const params = { url: editUrl.trim() }
      browserGraphQLRequest(S.openGraphInfo, params)
        .then(({ openGraphInfo }) => handleOgQueryInfo(openGraphInfo))
        .catch((e) => {
          setQueryingMediaReportIndexSafe(null)
          console.error('## og info: ', e)
          // oxlint-disable-next-line no-alert -- Legacy admin fallback while media report fetching is still alert-based.
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
