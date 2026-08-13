/**
 * Composes the Gateway HTTP application and its injected route dependencies.
 *
 * Business position:
 *
 *   Browser / service
 *     -> Gateway module
 *     -> selected Groupher application
 *     -> proxied response
 */

// Compatibility root entry for hosts that look for app.js.
export { default } from './dist/app.js'
