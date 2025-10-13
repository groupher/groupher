const { keys } = require('ramda')
// doc: https://tailwindcss.com/docs/screens

const { container: containerConf } = require('../../twConfig.json')

module.exports = ({ addComponents, theme }) => {
  console.log('## 加载 containers: ', containerConf)

  const containers = keys(containerConf).map((c) => ({
    [`.container-${c}`]: {
      maxWidth: containerConf[c].width,
      marginLeft: 'auto', // 替代 @apply mx-auto
      marginRight: 'auto',

      // 默认样式（移动端）
      paddingLeft: theme(`spacing.${containerConf[c].pl_lg}`), // 默认使用 lg 的 padding
      paddingRight: theme(`spacing.${containerConf[c].pr_lg}`),

      // ≥1024px 的样式
      [`@media (min-width: ${theme('screens.lg')})`]: {
        paddingLeft: theme(`spacing.${containerConf[c].pl_lg}`),
        paddingRight: theme(`spacing.${containerConf[c].pr_lg}`),
      },

      // ≥1280px 的样式
      [`@media (min-width: ${theme('screens.xl')})`]: {
        paddingLeft: theme(`spacing.${containerConf[c].pl}`),
        paddingRight: theme(`spacing.${containerConf[c].pr}`),
      },
    },
  }))

  addComponents(containers)
}
