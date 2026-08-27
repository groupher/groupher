import { KANBAN_LAYOUT } from '~/const/layout'
import type { TKanbanLayout } from '~/spec'

import ClassicLayoutPreview from './ClassicLayoutPreview'
import WaterfallLayoutPreview from './WaterfallLayoutPreview'

type TProps = {
  layout: TKanbanLayout
}

export default function KanbanLayoutPreview({ layout }: TProps) {
  if (layout === KANBAN_LAYOUT.WATERFALL) {
    return <WaterfallLayoutPreview />
  }

  return <ClassicLayoutPreview />
}
