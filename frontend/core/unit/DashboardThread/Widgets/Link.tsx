import useSalon from '../salon/widgets'
import CodeArea from './CodeArea'

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
