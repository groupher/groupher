import { AnimatePresence, domAnimation, LazyMotion, m } from 'motion/react'
import type { ComponentType, FC, ReactNode, SVGProps } from 'react'

import useTrans from '~/hooks/useTrans'
import RevertSVG from '~/icons/Back'
import SaveSVG from '~/icons/Save'
import type { TSpace } from '~/spec'
import useDashboard from '~/stores/dashboard/hooks'

import useHelper from '../logic/useHelper'
import type { TDsbFieldKey } from '../spec.d'
import {
  SAVING_BAR_ANIMATION,
  SAVING_BAR_LAYOUT_TRANSITION,
  SAVING_BAR_TRANSITION,
} from './constant'
import useSalon, { cn } from './salon'

type TActionIcon = ComponentType<SVGProps<SVGSVGElement>>

type TProps = {
  field?: TDsbFieldKey | null
  prefix?: string
  hint?: ReactNode
  children?: ReactNode
  loading?: boolean
  isTouched?: boolean
  minimal?: boolean
  disabled?: boolean
  cancelText?: string
  saveText?: string
  cancelIcon?: TActionIcon
  saveIcon?: TActionIcon
  width?: string
  wrapperClassName?: string
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
  cancelText,
  saveText,
  cancelIcon: CancelIcon = RevertSVG,
  saveIcon: SaveIcon = SaveSVG,
  onCancel = console.log,
  onConfirm = console.log,
  width = 'w-full',
  wrapperClassName,
  ...spacing
}) => {
  const s = useSalon({ minimal, width, ...spacing })
  const dsb$ = useDashboard()
  const { rollbackEdit, onSave } = useHelper()
  const { t } = useTrans()
  const resolvedPrefix = prefix ?? t('dsb.saving_bar.prefix')
  const resolvedCancelText = cancelText ?? t('dsb.saving_bar.cancel')
  const resolvedSaveText = saveText ?? t('dsb.saving_bar.save')
  const resolvedLoading = loading ?? dsb$.saving
  const cancel = (): void => {
    onCancel?.()
    if (field) {
      rollbackEdit(field)
    }
  }
  const confirm = (): void => {
    if (field) {
      onSave(field)
      setTimeout(() => onConfirm?.(), 500)
    } else {
      onConfirm?.()
    }
  }
  const actions = (
    <div className={s.actions}>
      <button
        type='button'
        className={s.cancelButton}
        disabled={resolvedLoading}
        aria-label={resolvedCancelText}
        title={resolvedCancelText}
        onClick={cancel}
      >
        <CancelIcon className={s.cancelIcon} />
        <span className={s.cancelLabel}>{resolvedCancelText}</span>
      </button>
      <button
        type='button'
        className={s.saveButton}
        disabled={disabled || resolvedLoading}
        aria-label={resolvedSaveText}
        aria-busy={resolvedLoading}
        title={resolvedSaveText}
        onClick={confirm}
      >
        <SaveIcon className={s.saveIcon} />
        <span className={s.saveLabel}>{resolvedSaveText}</span>
      </button>
    </div>
  )

  if (children !== null) {
    if (isTouched) {
      return (
        <LazyMotion features={domAnimation}>
          <m.div
            layout
            initial={SAVING_BAR_ANIMATION.initial}
            animate={SAVING_BAR_ANIMATION.animate}
            exit={SAVING_BAR_ANIMATION.exit}
            transition={SAVING_BAR_TRANSITION}
            className={s.container}
          >
            <div className={cn(s.wrapper, 'saving-bar-right-linear')}>
              {children}
              <div className='grow' />
              {actions}
            </div>
          </m.div>
        </LazyMotion>
      )
    }
    return children
  }

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence initial={false}>
        {isTouched && (
          <m.div
            key='saving-bar'
            initial={{ height: 0 }}
            animate={{ height: 'auto' }}
            exit={{ height: 0 }}
            transition={SAVING_BAR_LAYOUT_TRANSITION}
            className='overflow-hidden'
          >
            {/* Keep caller spacing/borders inside the measured height so they collapse smoothly. */}
            <m.div
              initial={SAVING_BAR_ANIMATION.initial}
              animate={SAVING_BAR_ANIMATION.animate}
              exit={SAVING_BAR_ANIMATION.exit}
              transition={SAVING_BAR_TRANSITION}
              className={wrapperClassName}
            >
              <div className={s.container}>
                <div className={cn(s.wrapper, 'pl-2.5', 'saving-bar-right-linear')}>
                  <div className='row-center'>
                    <SaveSVG className={s.infoIcon} />
                    <div className={s.hintText}>
                      {resolvedPrefix}
                      {hint && <div className={s.hint}>{hint}</div>}?
                    </div>
                  </div>
                  <div className='grow' />
                  {actions}
                </div>
              </div>
            </m.div>
          </m.div>
        )}
      </AnimatePresence>
    </LazyMotion>
  )
}

export default SavingBar
