import ArrowButton from '~/widgets/Buttons/ArrowButton'

import Portal from '../Portal'
import Adder from './Adder'
import List from './List'

import useSalon from '../salon/admin'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Portal
        title="管理员"
        desc={
          <>
            添加可参与社区内容管理的账号。
            <div className="inline-block">
              <ArrowButton>设置参考</ArrowButton>
            </div>
          </>
        }
      />
      <Adder />
      <List />
    </div>
  )
}
