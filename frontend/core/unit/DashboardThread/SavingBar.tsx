import type { FC, ReactNode } from 'react'

import useTrans from '~/hooks/useTrans'
import InfoSVG from '~/icons/Save'
import type { TSpace } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'
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
  loading,
  minimal = false,
  disabled = false,
  onCancel = console.log,
  onConfirm = console.log,
  width = 'w-full',
  ...spacing
}) => {
  const s = useSalon({ minimal, width, ...spacing })
  const dsb$ = useDashboard()
  const { rollbackEdit, onSave } = useHelper()
  const { t } = useTrans()
  const resolvedPrefix = prefix ?? t('dsb.saving_bar.prefix')
  const cancelText = t('dsb.saving_bar.cancel')
  const saveText = t('dsb.saving_bar.save')
  const resolvedLoading = loading ?? dsb$.saving

  if (children !== null) {
    if (isTouched) {
      return (
        <div className={cn(s.wrapper, 'saving-bar-right-linear')}>
          {children}
          <div className='grow' />
          <div className={s.actions}>
            <YesOrNoButtons
              cancelText={cancelText}
              saveText={saveText}
              disabled={disabled}
              loading={resolvedLoading}
              space={!resolvedLoading ? 1.5 : 0}
              onCancel={() => {
                onCancel?.()
                if (field) {
                  rollbackEdit(field)
                }
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
    return children
  }

  if (!isTouched) return null

  return (
    <div className={cn(s.wrapper, 'pl-2.5', 'saving-bar-right-linear')}>
      <div className='row-center'>
        <InfoSVG className={s.infoIcon} />
        <div className={s.hintText}>
          {resolvedPrefix}
          {hint && <div className={s.hint}>{hint}</div>}?
        </div>
      </div>
      <div className='grow' />
      <div className={s.actions}>
        <YesOrNoButtons
          cancelText={cancelText}
          disabled={disabled}
          saveText={saveText}
          loading={resolvedLoading}
          space={!resolvedLoading ? 1.5 : 0}
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
            if (field) {
              rollbackEdit(field)
            }
          }}
        />
      </div>
    </div>
  )
}

export default SavingBar
