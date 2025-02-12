import Radio from '~/widgets/Switcher/Radio'
import RangeSlider from '~/widgets/RangeSlider'

import Portal from '../Portal'
import SavingBar from '../SavingBar'

import useRSS from '../logic/useRSS'
import useSalon from '../salon/rss'

export default () => {
  const s = useSalon()

  const { rssFeedType, rssFeedCount, saving, getIsTouched, edit, rssOnSave, rssOnCancel } = useRSS()
  const isTouched = getIsTouched()

  return (
    <div className={s.wrapper}>
      <Portal title="RSS 设置" desc="RSS 设置说明。" />
      <div className={s.innerWrapper}>
        <div className={s.setting}>
          <h3 className={s.title}>Feed 类型</h3>
          <Radio
            size="small"
            items={[
              {
                value: '帖子全文',
                key: 'full',
              },
              {
                value: '帖子摘要',
                key: 'digest',
              },
            ]}
            activeKey={rssFeedType}
            onChange={(item) => edit(item.key, 'rssFeedType')}
          />
        </div>

        <div className={s.setting}>
          <h3 className={s.title}>Feed 数目</h3>
          <RangeSlider
            width="w-48"
            bottom={12}
            value={rssFeedCount}
            min={5}
            max={50}
            onChange={(v) => edit(v, 'rssFeedCount')}
            unit="条"
          />
        </div>

        <SavingBar
          isTouched={isTouched}
          onCancel={() => rssOnCancel()}
          onConfirm={() => rssOnSave()}
          loading={saving}
          top={10}
        />
      </div>
    </div>
  )
}
