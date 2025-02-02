import useSalon from '../salon/doc/Header'

const Header = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>目录</div>
      <div className="grow" />
      <div>块视图</div>
    </div>
  )
}

export default Header
