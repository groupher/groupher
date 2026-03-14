import { CHANGE_MODE } from '~/const/mode'

import Button from '~/widgets/Buttons/Button'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'
import useSalon, { cn } from './salon/footer'
import useLogic from './useLogic'

export default function Footer() {
  const s = useSalon()
  const { mode, editingTag, onCreate, onUpdate, onDelete, processing } = useLogic()

  if (processing) {
    return (
      <div className={s.wrapper}>
        <LavaLampLoading />
      </div>
    )
  }

  return (
    <div className={s.wrapper}>
      {mode === CHANGE_MODE.CREATE ? (
        <Button className={cn(s.actionButton, 'mt-1')} onClick={() => onCreate()}>
          创建新标签
        </Button>
      ) : (
        <div className={s.updateWrapper}>
          <Button className={cn(s.actionButton, 'mb-0.5')} onClick={() => onUpdate()}>
            更新链接
          </Button>

          <Button
            className={s.actionButton}
            red
            onClick={() => onDelete(editingTag)}
            ghost
            noBorder
          >
            删除标签
          </Button>
        </div>
      )}
    </div>
  )
}
