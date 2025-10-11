const { keys } = require('ramda')
// doc: https://tailwindcss.com/docs/screens

const { container: containerConf } = require('../../twConfig.json')

module.exports = ({ addComponents, theme }) => {
  // console.log('## 加载 containers')

  // console.log('containerConf:', JSON.stringify(containerConf, null, 2))

  // console.log('theme(spacing.52):', theme('spacing.52'))
  // console.log('theme(screens.lg):', theme('screens.lg'))

  // example:
  // '.container-home': {
  //   maxWidth: C.home.width,
  //   paddingLeft: theme(`spacing.${C.home.pl}`),
  //   paddingRight: theme(`spacing.${C.home.pr}`),
  //   '@apply mx-auto': {},
  //   // '@screen md': {
  //   //   paddingLeft: theme('spacing.6'),
  //   //   paddingRight: theme('spacing.6'),
  //   // },
  // },

  // offical metric
  // container	None	width: 100%;
  //   sm (640px)	max-width: 640px;
  //   md (768px)	max-width: 768px;
  //   lg (1024px)	max-width: 1024px;
  //   xl (1280px)	max-width: 1280px;
  //   2xl (1536px)	max-width: 1536px;

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

  // const containers = keys(containerConf).map((c) => ({
  //   [`.container-${c}`]: {
  //     maxWidth: containerConf[c].width,
  //     '@apply mx-auto': {},

  //     // 1024 > x < 1280, use follow
  //     '@screen lg': {
  //       paddingLeft: theme(`spacing.${containerConf[c].pl_lg}`),
  //       paddingRight: theme(`spacing.${containerConf[c].pr_lg}`),
  //     },
  //     // > 1280, use follow
  //     '@screen xl': {
  //       paddingLeft: theme(`spacing.${containerConf[c].pl}`),
  //       paddingRight: theme(`spacing.${containerConf[c].pr}`),
  //     },
  //   },
  // }))

  addComponents(containers)
}
