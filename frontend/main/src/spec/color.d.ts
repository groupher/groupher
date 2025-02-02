export type TColorName =
  | 'BLACK'
  | 'PINK'
  | 'RED'
  | 'ORANGE'
  | 'YELLOW'
  | 'BROWN'
  | 'GREEN_LIGHT'
  | 'GREEN'
  | 'CYAN'
  | 'CYAN_LIGHT'
  | 'BLUE'
  | 'PURPLE'

export type TPrimaryColor = { primaryColor: TColorName }
export type TColor = { color?: TColorName; $color?: TColorName }
