import Button from '~/widgets/Buttons/Button'
import Tabs from '~/widgets/Switcher/Tabs'
import Radio from '~/widgets/Switcher/Radio'

import Input from '~/widgets/Input'
import ViewSVG from '~/icons/article/Viewed'

import { WIDGET_TYPES } from '../constant'

import Portal from '../Portal'
import BaseSetting from './BaseSetting'
import CodeArea from './CodeArea'

import useWidgets from '../logic/useWidgets'
import useSalon from '../salon/widgets'

export default () => {
  const s = useSalon()

  const { widgetsType, edit } = useWidgets()

  return (
    <div className={s.wrapper}>
      <Portal
        title="网站插件"
        desc="为您的主页添加社区，更新日志，看板等插件，让产品用户及时方便的了解最新动态。"
      />

      <BaseSetting />

      <div className={s.typeSelect}>
        <div className={s.tabs}>
          <Tabs
            items={WIDGET_TYPES}
            activeKey={widgetsType}
            onChange={(slug) => {
              edit(slug, 'widgetsType')
              // onSave('widgetsType')
              console.log('## onSave widgetsType')
            }}
          />
        </div>
        <Button size="small" space={8} ghost className="w-20">
          <ViewSVG className={s.viewIcon} />
          预览
        </Button>
      </div>
      <div className="mt-4" />
      <CodeArea />
      <div className={s.hint}>
        启用网站插件，请复制以上代码到您的站点源码中。如果团队中缺乏相关技术人员，请联系我们。
      </div>

      <div className="mt-8" />

      <div className={s.inputWrapper}>
        <label className={s.inputLabel}>目标元素 ID:</label>
        <Input className={s.input} />
      </div>
      <div className={s.inputWrapper}>
        <label className={s.inputLabel}>组件尺寸:</label>
        <Radio
          size="small"
          items={[
            {
              value: '小',
              key: '1',
            },
            {
              value: '中',
              key: '2',
              dimOnActive: true,
            },
            {
              value: '大',
              key: '3',
              dimOnActive: true,
            },
          ]}
          activeKey="1"
        />
      </div>
    </div>
  )
}
