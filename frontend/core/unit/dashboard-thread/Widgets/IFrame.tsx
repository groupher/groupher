import useSalon from '../salon/widgets'
import CodeArea from './CodeArea'

export default function IFrame() {
  const s = useSalon()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>TODO: IFrame setup。</div>
    </>
  )
}
