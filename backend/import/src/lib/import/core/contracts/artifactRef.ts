/**
 * Implements the Src Lib Import Core Contracts ArtifactRef boundary inside Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export type TArtifactRef = string
