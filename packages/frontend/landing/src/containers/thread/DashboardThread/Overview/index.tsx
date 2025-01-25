import Portal from '../Portal'
import BasicNumbers from './BasicNumbers'

import useSalon from '../salon/overview'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <Portal title="设置概览" desc="基础设置向导，帮助文档等等" />
      <section className={s.section}>
        <BasicNumbers />
        {/* <SectionLabel title="基本信息" /> */}
      </section>
    </div>
  )
}
