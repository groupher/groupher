import type { FC } from 'react'

import ArrowSVG from '~/icons/ArrowSimple'

import useSalon, { cn } from './salon/fold_box'

type TProps = {
  fold: boolean
  mode: 'article' | 'comment'
  onFold: () => void
  onExpand: () => void
}

const FoldBox: FC<TProps> = ({ fold, onFold, onExpand, mode }) => {
  const s = useSalon({ fold })

  return (
    <div className={s.wrapper} onClick={() => (fold ? onExpand() : onFold())}>
      {!fold && (
        <div className={cn(s.hint, 'opacity-20', mode === 'article' ? 'text-base' : 'text-sm')}>
          折叠内容
          <ArrowSVG className={cn(s.arrowIcon, 'rotate-180')} />
        </div>
      )}
      {fold && (
        <div className={cn(s.hint, mode === 'article' ? 'text-base' : 'text-sm')}>
          展开全部
          <ArrowSVG className={s.arrowIcon} />
        </div>
      )}
    </div>
  )
}

export default FoldBox
