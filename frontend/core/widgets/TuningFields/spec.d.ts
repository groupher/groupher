export type TRangeFieldProps = {
  label?: string
  value: number
  width?: string
  onChange: (value: number) => void
  onChangeEnd?: (value: number) => void
}
