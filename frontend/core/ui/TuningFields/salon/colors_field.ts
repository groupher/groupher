import useBase from '.'

export default function useSalon() {
  const base = useBase()

  return {
    wrapper: base.wrapper,
    label: base.label,
    content: base.content,
    chips: 'row-center gap-2',
    chip: 'size-5 circle border border-transparent pointer trans-all-200',
  }
}
