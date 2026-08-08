// next.config.js
const withBaseConfig = require('@groupher/frontend-core/next.config')
const { withWorkflow } = require('workflow/next')

module.exports = withWorkflow(
  withBaseConfig({
    // Keep Dashboard assets/HMR namespaced when Main and Dashboard share the Gateway host.
    assetPrefix: '/dashboard',
  }),
)
