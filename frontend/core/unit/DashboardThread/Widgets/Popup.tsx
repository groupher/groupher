import CodeArea from './CodeArea'
import useSalon from './salon'

export default function Popup() {
  const s = useSalon()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>TODO: popup setup。</div>
    </>
  )
}
