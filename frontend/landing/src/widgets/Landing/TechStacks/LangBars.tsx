import useSalon, { cn } from '../salon/tech_stacks/lang_bars'

const RepoPreview = () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.barWrapper}>
        <div className={cn(s.bar, s.bgPurple, 'w-1/2 rounded-l-md')} />
        <div className={cn(s.bar, s.bgBlue, 'w-1/2 rounded-r-md')} />
      </div>
      <div className={s.langWrapper}>
        <div className={s.lang}>
          <div className={cn(s.dot, s.bgPurple)} />
          Elixir
        </div>
        <div className={s.lang}>
          <div className={cn(s.dot, s.bgBlue)} />
          TypeScript
        </div>
      </div>
    </div>
  )
}

export default RepoPreview
