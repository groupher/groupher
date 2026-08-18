/**
 * Implements the Src Lib Content Import Core Contracts ArtifactRef boundary inside Content Import.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TArtifactRef = string
