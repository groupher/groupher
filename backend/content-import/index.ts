/**
 * Publishes the . boundary used by Content Import.
 *
 * Business position:
 *
 *   Dash proxy / Phoenix import job
 *     -> Content Import module
 *     -> canonical source tree / apply batch
 *     -> Phoenix persistence boundary
 */

export { default } from './src/service-app'
export { createApp } from './src/app'
