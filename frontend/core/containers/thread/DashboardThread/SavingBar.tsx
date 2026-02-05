import type { FC, ReactNode } from 'react'
import InfoSVG from '~/icons/Save'
import useTrans from '~/hooks/useTrans'
import type { TSpace } from '~/spec'
import YesOrNoButtons from '~/widgets/Buttons/YesOrNoButtons'
import useHelper from './logic/useHelper'
import useSalon, { cn } from './salon/saving_bar'
import type { TDsbFieldKey } from './spec.d'

type TProps = {
  field?: TDsbFieldKey | null
  prefix?: string
  hint?: ReactNode
  children?: ReactNode
  loading?: boolean
  isTouched?: boolean
  minimal?: boolean
  disabled?: boolean
  width?: string
  onCancel?: () => void
  onConfirm?: () => void
} & TSpace

const SavingBar: FC<TProps> = ({
  field = null,
  prefix = null,
  hint = null,
  children = null,
  isTouched = false,
  loading = false,
  minimal = false,
  disabled = false,
  onCancel = console.log,
  onConfirm = console.log,
  width = 'w-full',
  ...spacing
}) => {
  const s = useSalon({ minimal, width, ...spacing })
  const { rollbackEdit, onSave } = useHelper()
  const { t } = useTrans()
  const resolvedPrefix = prefix ?? t('dsb.saving_bar.prefix')
  const cancelText = t('dsb.saving_bar.cancel')
  const confirmText = t('dsb.saving_bar.confirm')

  if (children !== null) {
    if (isTouched) {
      return (
        <div className={cn(s.wrapper, 'saving-bar-left-linear')}>
          {children}
          <div className='grow' />
          <div className={s.actions}>
            <YesOrNoButtons
              cancelText={cancelText}
              confirmText={confirmText}
              disabled={disabled}
              loading={loading}
              space={!loading ? 0.5 : 0}
              onCancel={() => {
                onCancel?.()
                field && rollbackEdit(field)
              }}
              onConfirm={() => {
                if (field) {
                  onSave(field)
                  setTimeout(() => onConfirm?.(), 500)
                } else {
                  onConfirm?.()
                }
              }}
            />
          </div>
        </div>
      )
    }
    return <>{children}</>
  }

  if (!isTouched) return null

  return (
    <div className={cn(s.wrapper, 'pl-2.5', 'saving-bar-right-linear')}>
      <div className='row-center'>
        <InfoSVG className={s.infoIcon} />
        <div className={s.hintText}>
          {resolvedPrefix}
          {hint && <div className={s.hint}>{hint}</div>} ?
        </div>
      </div>
      <div className='grow' />
      <div className={s.actions}>
        <YesOrNoButtons
          cancelText={cancelText}
          disabled={disabled}
          confirmText={confirmText}
          space={!loading ? 0.5 : 0}
          onConfirm={() => {
            if (field) {
              onSave(field)
              setTimeout(() => onConfirm?.(), 500)
            } else {
              onConfirm?.()
            }
          }}
          onCancel={() => {
            onCancel?.()
            field && rollbackEdit(field)
          }}
        />
      </div>
    </div>
  )
}

export default SavingBar
