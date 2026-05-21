import CodeArea from './CodeArea'
import useSalon from './salon'

export default function Modal() {
  const s = useSalon()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>TODO: modal setup。</div>
    </>
  )
}
