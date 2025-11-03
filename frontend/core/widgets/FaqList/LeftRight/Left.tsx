import useSalon from '../salon/left_right/left'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.topping}>F.A.Q</div>
      <div className={s.title}>常见使用问题</div>
      <div className={s.desc}>
        如果仍有疑问，请参考<span className={s.link}>相关文档</span>或直接在社区
        <span className={s.link}>发帖求助</span>。
      </div>
    </div>
  )
}
