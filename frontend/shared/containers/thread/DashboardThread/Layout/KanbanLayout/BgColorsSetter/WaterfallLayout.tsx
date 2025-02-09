import type { FC } from 'react'

import useSalon, { cn } from '../../../salon/layout/kanban_layout/bg_colors_setter/waterfall_layout'

type TProps = {
  isBoard1Hovered: boolean
  isBoard2Hovered: boolean
  isBoard3Hovered: boolean
}

const WaterfallLayout: FC<TProps> = ({ isBoard1Hovered, isBoard2Hovered, isBoard3Hovered }) => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={cn(s.header, s.bgTodo, isBoard1Hovered && s.bgTodoActive)} />
      <div className={s.content}>
        <div className={cn(s.bar, 'top-5 left-2 w-4/12')} />
        <div className={cn(s.bar, 'top-5 right-2 w-14 opacity-20')} />

        <div className={cn(s.bar, 'top-10 left-2 w-6/12 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'top-10 right-2 w-14 opacity-15')} />

        <div className={cn(s.bar, 'top-16 left-2 w-4/12 opacity-10')} />
        <div className={cn(s.bar, 'top-16 right-2 w-10 opacity-10')} />
      </div>
      <div className={cn(s.header, s.bgWip, isBoard2Hovered && s.bgWipActive)} />
      <div className={s.content}>
        <div className={cn(s.bar, 'top-5 left-2 w-6/12')} />
        <div className={cn(s.bar, 'top-5 right-2 w-14 opacity-20')} />

        <div className={cn(s.bar, 'top-10 left-2 w-7/12 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'top-10 right-2 w-14 opacity-15')} />

        <div className={cn(s.bar, 'top-16 left-2 w-4/12 opacity-10')} />
        <div className={cn(s.bar, 'top-16 right-2 w-10 opacity-10')} />
      </div>
      <div className={cn(s.header, s.bgDone, isBoard3Hovered && s.bgDoneActive)} />
      <div className={s.content}>
        <div className={cn(s.bar, 'top-5 left-2 w-3/12')} />
        <div className={cn(s.bar, 'top-5 right-2 w-14 opacity-20')} />

        <div className={cn(s.bar, 'top-10 left-2 w-7/12 mt-0.5 opacity-20')} />
        <div className={cn(s.bar, 'top-10 right-2 w-14 opacity-15')} />

        <div className={cn(s.bar, 'top-16 left-2 w-4/12 opacity-10')} />
        <div className={cn(s.bar, 'top-16 right-2 w-10 opacity-10')} />
      </div>
    </div>
  )
}

export default WaterfallLayout
