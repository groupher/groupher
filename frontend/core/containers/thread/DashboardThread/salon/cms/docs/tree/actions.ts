import useTwBelt from '~/hooks/useTwBelt'

export default () => {
  const { cn, fg, br, fill } = useTwBelt()

  return {
    wrapper: cn('column w-96 mb-9'),
    preview: cn('mb-5 pb-5 border-b', br('divider')),
    previewButtons: 'row-center mt-2',
    head: 'row items-start',
    title: cn('grow text-sm bold-sm', fg('title')),
    updateHint: cn('w-1/5 text-xs align-right mt-1', fg('hint')),
    //
    addIcon: cn('size-3 mr-1.5 opacity-80', fill('digest')),
    editIcon: cn('size-3 mr-1.5 opacity-80', fill('digest')),
  }
}
