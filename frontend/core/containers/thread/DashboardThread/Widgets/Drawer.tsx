import Input from '~/widgets/Input'
import Radio from '~/widgets/Switcher/Radio'

import useSalon from '../salon/widgets'
import CodeArea from './CodeArea'

export default () => {
  const s = useSalon()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>
        启用网站插件，请复制以上代码到您的站点源码中。如果团队中缺乏相关技术人员，请联系我们。
      </div>

      <div className='mt-8' />

      <div className={s.inputWrapper}>
        <div className={s.inputLabel}>目标元素 ID:</div>
        <Input className={s.input} />
      </div>
      <div className={s.inputWrapper}>
        <div className={s.inputLabel}>组件尺寸:</div>
        <Radio
          size='small'
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
          activeKey='1'
        />
      </div>
    </>
  )
}
