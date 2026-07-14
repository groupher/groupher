import type { FC } from 'react'

import useSalon from '../salon/pin_list'
import type { TEditingTarget, TSideTreeLinkInput, TSideTreePin } from '../spec'
import Pin from './Pin'

type TProps = {
  pins: readonly TSideTreePin[]
  editingTarget: TEditingTarget
  onCancelEdit: () => void
  onDelete: (pinId: string) => void
  onEdit: (target: TEditingTarget) => void
  onSave: (pinId: string, input: TSideTreeLinkInput) => void
  onStyleChange: (pinId: string, marker: TSideTreePin['marker']) => void
}

const PinList: FC<TProps> = ({
  pins,
  editingTarget,
  onCancelEdit,
  onDelete,
  onEdit,
  onSave,
  onStyleChange,
}) => {
  const s = useSalon()

  if (pins.length === 0) return null

  return (
    <section className={s.wrapper} aria-label='Pins'>
      <div className={s.list}>
        {pins.map((pin) => (
          <Pin
            key={pin.id}
            item={pin}
            editingTarget={editingTarget}
            onCancelEdit={onCancelEdit}
            onDelete={onDelete}
            onEdit={onEdit}
            onSave={onSave}
            onStyleChange={onStyleChange}
          />
        ))}
      </div>
      <div className={s.divider} />
    </section>
  )
}

export default PinList
