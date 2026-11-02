/* *
 * KanbanThread
 */

import type { TTicketFilter } from '~/spec'

import Actions from './Actions'
import useSalon from './salon'
import Sections from './Sections'

export default function WaterfallLayout({
  internal = false,
  ticketFilter = {},
}: {
  internal?: boolean
  ticketFilter?: TTicketFilter
}) {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Actions />
      <Sections internal={internal} ticketFilter={ticketFilter} />
    </div>
  )
}
