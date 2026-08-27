import type { ComponentType } from 'react'

import { LogicContext, useLogicValue } from './useLogic'

export default function LogicProvider<TProps extends object>(Component: ComponentType<TProps>) {
  return function LogicProviderWrapper(props: TProps) {
    const value = useLogicValue()

    return (
      <LogicContext.Provider value={value}>
        <Component {...props} />
      </LogicContext.Provider>
    )
  }
}
