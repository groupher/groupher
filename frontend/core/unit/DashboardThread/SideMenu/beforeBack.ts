export type TBeforeDashboardBack = () => Promise<boolean>

let beforeBack: TBeforeDashboardBack | null = null

/** Runs the register before dashboard back operation at the frontend shared boundary. */
export const registerBeforeDashboardBack = (handler: TBeforeDashboardBack): (() => void) => {
  beforeBack = handler

  return () => {
    if (beforeBack === handler) beforeBack = null
  }
}

/** Runs the run before dashboard back operation at the frontend shared boundary. */
export const runBeforeDashboardBack = async (): Promise<boolean> =>
  beforeBack ? beforeBack() : true
