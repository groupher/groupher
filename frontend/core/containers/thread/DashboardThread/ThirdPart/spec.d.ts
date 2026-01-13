import type { INTEGRATE_ANALYSIS_TOOLS } from './constant'

export type TIntegrateAnalysisTool = (typeof INTEGRATE_ANALYSIS_TOOLS)[number]

export type TIntegrateAnalysisToolKey = TIntegrateAnalysisTool['key']
