import type { FC } from 'react'

import type { TTicketViewModel } from '~/spec'

import TicketCard from './TicketCard'

const KanbanItem: FC<{ viewModel: TTicketViewModel; internal?: boolean }> = ({
  viewModel,
  internal = false,
}) => <TicketCard viewModel={viewModel} internal={internal} />

export default KanbanItem
