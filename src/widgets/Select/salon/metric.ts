import type { TThemeMap } from '~/spec'

export const getSelectStyles = (theme: TThemeMap) => {
  return {
    container: (base) => ({
      ...base,
      outline: 'none',
      zIndex: 3,
      '&:hover': {
        borderColor: '#024759',
      },
      '&:focus': {
        borderColor: '#024759',
      },
    }),
    // 容器 -- not work
    control: (base, state) => ({
      ...base,
      borderColor: theme.editor.border,
      // 可以消除 outLine
      boxShadow: state.isFocused ? '0 0 0 1px #00627A' : 'none',
      '&:hover': {
        borderColor: theme.article.title,
      },
      '&:focus': {
        borderColor: theme.article.title,
      },
    }),
    indicatorContainer: (base) => ({
      ...base,
      // background: '#00262F',
    }),
    indicatorSeparator: (base) => ({
      ...base,
      alignSelf: 'none',
      height: '12px',
      marginLeft: '-1px',
      // background: '#405356',
    }),
    placeholder: (base) => ({
      ...base,
      fontSize: '13px',
      color: theme.article.digest,
      marginLeft: 5,
      opacity: 0.8,
    }),
    // 输入框
    valueContainer: (base) => ({
      ...base,
      // background: '#052630',
      width: '100%',
    }),
    // 单值
    singleValue: (base) => ({
      ...base,
      color: theme.article.title,
      // background: '#00343E',
      padding: '0 5px',
      borderRadius: '3px',
      maxWidth: '200px',
    }),
    multiValue: (base) => ({
      ...base,
      color: theme.article.title,
      // background: '#00343E',
      borderRadius: '3px',
    }),
    multiValueLabel: (base) => ({
      ...base,
      color: theme.article.title,
    }),
    multiValueRemove: (base) => ({
      ...base,
      color: theme.article.digest,
      '&:hover': {
        cursor: 'pointer',
        color: theme.rainbow.red,
        // background: '#00343E',
      },
    }),
    menu: (base) => ({
      ...base,
      zIndex: 9999,
      // background: '#00262F',
    }),
    menuList: (base) => ({
      ...base,
      border: '1px solid',
      borderColor: theme.divider,
      zIndex: 9999,
    }),
    menuPortal: (base) => ({
      ...base,
      zIndex: 9999,
    }),
    clearIndicator: (base, state) => ({
      ...base,
      cursor: 'pointer',
      color: theme.article.digest,
      opacity: state.isFocused ? 1 : 0.5,
    }),
    dropdownIndicator: (base, state) => ({
      ...base,
      cursor: 'pointer',
      color: theme.editor.border,
      opacity: state.isFocused ? 1 : 0.8,
    }),
    option: (base, state) => ({
      ...base,
      height: '100%',
      background: state.isSelected ? theme.article.title : theme.hoverBg,
      // color: 'tomato',

      '&:hover': {
        background: state.isSelected ? theme.article.title : theme.divider,
        cursor: 'pointer',
      },
    }),
  }
}

export const holder = 1
