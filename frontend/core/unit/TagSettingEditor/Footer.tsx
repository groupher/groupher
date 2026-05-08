import { CHANGE_MODE } from '~/const/mode'
import useTrans from '~/hooks/useTrans'
import Button from '~/widgets/Buttons/Button'
import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import useSalon from './salon/footer'
import useLogic from './useLogic'

type TProps = {
  logic: ReturnType<typeof useLogic>
}

export default function Footer({ logic }: TProps) {
  const s = useSalon()
  const { t } = useTrans()
  const { mode, editingTag, onCreate, onUpdate, onDelete, processing, canSubmit } = logic

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
        <Button noBorder disabled={!canSubmit} onClick={() => onCreate()}>
          {t('dsb.tags.editor.create')}
        </Button>
      ) : (
        <div className={s.updateWrapper}>
          <Button noBorder disabled={!canSubmit} onClick={() => onUpdate()}>
            {t('dsb.tags.editor.update')}
          </Button>

          <Button red onClick={() => editingTag && onDelete(editingTag)} ghost noBorder>
            {t('dsb.tags.editor.delete')}
          </Button>
        </div>
      )}
    </div>
  )
}
