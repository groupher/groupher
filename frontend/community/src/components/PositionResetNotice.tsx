import useTrans from '~/hooks/useTrans'

export default function PositionResetNotice() {
  const { t } = useTrans()
  return <p role='status'>{t('pagination.position_reset')}</p>
}
