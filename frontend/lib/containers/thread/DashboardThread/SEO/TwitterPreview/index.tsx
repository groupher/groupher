import { TW_CARD } from '../../constant'

import useSEO from '../../logic/useSEO'

import SummaryLargeLayout from './SummaryLargeLayout'
import SummaryLayout from './SummaryLayout'

export default () => {
  const { twCard } = useSEO()

  return twCard !== TW_CARD.SUMMARY_LARGE_IMAGE ? <SummaryLargeLayout /> : <SummaryLayout />
}
