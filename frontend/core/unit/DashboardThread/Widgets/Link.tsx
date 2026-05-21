import CodeArea from './CodeArea'
import useSalon from './salon'

export default function Link() {
  const s = useSalon()

  return (
    <>
      <div className='mt-4' />
      <CodeArea />
      <div className={s.hint}>TODO: Link setup。</div>
    </>
  )
}
