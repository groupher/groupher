import useSalon from './salon/empty_item'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>内容为空</div>
    </div>
  )
}
