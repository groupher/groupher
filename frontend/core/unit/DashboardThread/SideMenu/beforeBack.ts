export type TBeforeDashboardBack = () => Promise<boolean>

let beforeBack: TBeforeDashboardBack | null = null

export const registerBeforeDashboardBack = (handler: TBeforeDashboardBack): (() => void) => {
  beforeBack = handler

  return () => {
    if (beforeBack === handler) beforeBack = null
  }
}

export const runBeforeDashboardBack = async (): Promise<boolean> =>
  beforeBack ? beforeBack() : true
