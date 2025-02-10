import HammerSVG from '~/icons/HammerSolid'

import TechItem from './TechItem'

import useSalon from '../salon/tech_stacks/stack_card'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.banner}>
        <div className={s.topping}>
          <HammerSVG className={s.hammerIcon} style={s.hammerIconStyle} />
          <div className={s.stackText} style={s.gradientTextStyle}>
            Techstack
          </div>
        </div>

        <h3 className={s.title}>主要技术栈</h3>
      </div>
      <div className={s.techs}>
        <TechItem path="elixir.png" name="Elixir" />
        <TechItem path="phoenix.png" name="Phoenix" />
        <TechItem path="pg.png" name="PG" />
        <TechItem path="absinthe.png" name="Absinthe" />
        <TechItem path="ecto.png" name="Ecto" />
        <TechItem path="graphql.png" name="GraphQL" />
        <TechItem path="nextjs.png" name="Next.js" iconSize="size-12" />
        <TechItem path="react.png" name="React" />
        <TechItem path="typescript.png" name="TypeScript" iconSize="size-7" />
        <TechItem path="valtio.png" name="Valtio" iconSize="size-7" />
        <TechItem path="tailwind.png" name="Tailwind" iconSize="size-12" />
        <TechItem path="slate.png" name="Slate" />
        <TechItem path="phosphor.png" name="Phosphor" />
        <TechItem path="emacs.png" name="Emacs" />
        <TechItem path="notes.png" name="Notes" />
      </div>
    </div>
  )
}
