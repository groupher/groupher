'use client'

/* *
 * KanbanThread
 *
 */

import { useState } from 'react'

import { KANBAN_LAYOUT } from '~/const/layout'
import useLayout from '~/hooks/useLayout'
import type { TTicketFilter } from '~/spec'

import ClassicLayout from './ClassicLayout'
import useSalon from './salon'
import TicketCaseList from './TicketCaseList'
import TicketFilters from './TicketFilters'
import WaterfallLayout from './WaterfallLayout'

export default function KanbanThread({ internal = false }: { internal?: boolean }) {
  const s = useSalon()
  const { kanbanLayout } = useLayout()
  const [ticketFilter, setTicketFilter] = useState<TTicketFilter>({})

  return (
    <div className={s.wrapper}>
      {internal && <TicketFilters value={ticketFilter} onChange={setTicketFilter} />}
      {internal && ticketFilter.type === 'CASE' ? (
        <TicketCaseList filter={ticketFilter} />
      ) : kanbanLayout === KANBAN_LAYOUT.WATERFALL ? (
        <WaterfallLayout internal={internal} ticketFilter={ticketFilter} />
      ) : (
        <ClassicLayout internal={internal} ticketFilter={ticketFilter} />
      )}
    </div>
  )
}
