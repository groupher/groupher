// next.config.js
const withBaseConfig = require('@groupher/frontend-core/next.config')
const { withWorkflow } = require('workflow/next')

module.exports = withWorkflow(
  withBaseConfig({
    assetPrefix: process.env.NODE_ENV === 'production' ? '/dashboard' : '',
  }),
)
