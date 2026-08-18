/**
 * Publishes the . boundary used by Content Import.
 *
 * Business position:
 *
 *   Dashboard / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export { default } from './src/dashboard-app'
export { createApp } from './src/app'
