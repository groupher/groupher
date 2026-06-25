import useTrans from '~/hooks/useTrans'
import RangeSlider from '~/widgets/RangeSlider'
import Radio from '~/widgets/Switcher/Radio'

import useRSS from '../logic/useRSS'
import Portal from '../Portal'
import SavingBar from '../SavingBar'
import useSalon from './salon'

export default function RSS() {
  const s = useSalon()
  const { t } = useTrans()

  const { rssFeedType, rssFeedCount, isTouched, edit, rssOnSave, rssOnCancel } = useRSS()

  return (
    <div className={s.wrapper}>
      <Portal title={t('dsb.rss.title')} desc={t('dsb.rss.desc')} />
      <div className={s.innerWrapper}>
        <div className={s.setting}>
          <h3 className={s.title}>{t('dsb.rss.feed_type')}</h3>
          <Radio
            size='small'
            items={[
              {
                value: t('dsb.rss.feed_full'),
                key: 'full',
              },
              {
                value: t('dsb.rss.feed_digest'),
                key: 'digest',
              },
            ]}
            activeKey={rssFeedType}
            onChange={(item) => edit(item.key, 'rssFeedType')}
          />
        </div>

        <div className={s.setting}>
          <h3 className={s.title}>{t('dsb.rss.feed_count')}</h3>
          <RangeSlider
            width='w-48'
            bottom={12}
            value={rssFeedCount}
            min={5}
            max={50}
            onChange={(v) => edit(v, 'rssFeedCount')}
            unit={t('dsb.rss.unit')}
          />
        </div>

        <SavingBar
          isTouched={isTouched}
          onCancel={() => rssOnCancel()}
          onConfirm={() => rssOnSave()}
          top={10}
        />
      </div>
    </div>
  )
}
