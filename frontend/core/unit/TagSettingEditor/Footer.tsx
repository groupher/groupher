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
  const { mode, editingTag, onCreate, onUpdate, onDelete, processing } = logic

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
        <Button noBorder onClick={() => onCreate()}>
          {t('dsb.tags.editor.create')}
        </Button>
      ) : (
        <div className={s.updateWrapper}>
          <Button noBorder onClick={() => onUpdate()}>
            {t('dsb.tags.editor.update')}
          </Button>

          <Button red onClick={() => onDelete(editingTag)} ghost noBorder>
            {t('dsb.tags.editor.delete')}
          </Button>
        </div>
      )}
    </div>
  )
}
