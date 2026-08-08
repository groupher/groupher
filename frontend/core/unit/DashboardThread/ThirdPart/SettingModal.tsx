import { useEffect, useMemo, useState } from 'react'

import useTrans from '~/hooks/useTrans'
import Img from '~/Img'
import type { TThirdPartyAnalyticsConfig } from '~/lib/thirdPartyAnalytics'
import { isValidThirdPartyAnalyticsConfig } from '~/lib/thirdPartyAnalytics'
import useDashboard from '~/stores/dashboard/hooks'
import ArrowLinker from '~/ui/ArrowLinker'
import Button from '~/ui/Buttons/Button'
import ToggleSwitch from '~/ui/Buttons/ToggleSwitch'
import Input from '~/ui/Input'
import Modal from '~/ui/Modal'
import { toast } from '~/ui/Toaster'

import { FIELD } from '../constant'
import useHelper from '../logic/useHelper'
import { getIntegrationIconSrc } from './constant'
import useSalon, { cn } from './salon/setting_modal'
import type { TIntegrateAnalysisTool, TThirdPartyAnalyticsProviderField } from './spec'

type TProps = {
  show: boolean
  service: TIntegrateAnalysisTool | null

  onClose: () => void
}

const getIdentityConfigField = (
  service: TIntegrateAnalysisTool,
): TThirdPartyAnalyticsProviderField | null =>
  service.configFields.find((field) => field.key === service.identityField) ??
  service.configFields.find((field) => field.requiredWhenEnabled) ??
  null

const SettingModal = ({ show, onClose, service }: TProps) => {
  const s = useSalon()
  const { t } = useTrans()
  const dsb$ = useDashboard()
  const { onSave } = useHelper()
  const [enabled, setEnabled] = useState(false)
  const [value, setValue] = useState('')

  const savedConfig = useMemo(() => {
    if (!service) return null

    return dsb$.thirdPartyAnalytics.find((item) => item.provider === service.provider) ?? null
  }, [dsb$.thirdPartyAnalytics, service])

  useEffect(() => {
    if (!service || !show) return

    const configField = getIdentityConfigField(service)
    if (!configField) return

    setEnabled(savedConfig?.enabled ?? false)
    setValue(String(savedConfig?.[configField.key] ?? ''))
  }, [savedConfig, service, show])

  if (!service) return null

  const configField = getIdentityConfigField(service)
  if (!configField) return null

  const nextConfig: TThirdPartyAnalyticsConfig = {
    provider: service.provider,
    enabled,
    [configField.key]: value.trim(),
  }

  const canSave = !enabled || isValidThirdPartyAnalyticsConfig(nextConfig)

  const handleSave = (): void => {
    if (!canSave) {
      toast(t(configField.placeholder), 'error')
      return
    }

    const nextConfigs = [
      ...dsb$.thirdPartyAnalytics.filter((item) => item.provider !== service.provider),
      nextConfig,
    ]

    dsb$.editField(FIELD.THIRD_PARTY_ANALYTICS, nextConfigs)
    onSave(FIELD.THIRD_PARTY_ANALYTICS)
    onClose()
  }

  return (
    <Modal show={show} width='460px' onClose={() => onClose()} showCloseBtn={false}>
      <div className={s.wrapper}>
        <div className={s.header}>
          <div className={s.iconBox}>
            <Img
              src={getIntegrationIconSrc(service.provider)}
              alt={`${service.title} icon`}
              className={cn(s.icon, service.provider === 'gtm' && 'w-8 h-auto')}
            />
          </div>
          <h1 className={s.title}>{t(service.title)}</h1>
          <span className={s.enable}>{t('dsb.third_part.enable')}</span>
          <ToggleSwitch checked={enabled} onChange={setEnabled} />
        </div>
        <div className={s.content}>
          <p className={s.desc}>{t(service.detail)}</p>
        </div>
        <div className={s.br} />
        <h2 className={s.subTitle}>{t(configField.label)}</h2>
        <p className={cn(s.desc, 'mb-4')}>{t(configField.desc)}</p>
        <Input
          placeholder={t(configField.placeholder)}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />

        <div className={s.br} />

        <div className={s.footer}>
          <ArrowLinker href={service.docsUrl} target='_blank' noColor>
            {t('dsb.third_part.learn_more')}
          </ArrowLinker>

          <Button
            disabled={!canSave}
            loading={dsb$.savingField === FIELD.THIRD_PARTY_ANALYTICS}
            onClick={handleSave}
          >
            {t('dsb.third_part.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

export default SettingModal
