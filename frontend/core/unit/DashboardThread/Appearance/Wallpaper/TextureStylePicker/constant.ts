/* 瓦片纹理：网格布局的行 */
export const TILE_ROWS = [
  ['a1', 'a2', 'a3', 'a4'],
  ['b1', 'b2', 'b3', 'b4'],
  ['c1', 'c2', 'c3', 'c4'],
  ['d1', 'd2', 'd3', 'd4'],
  ['e1', 'e2', 'e3', 'e4'],
]

/* 点阵纹理：九宫格定位标识 */
export const DOTS = ['tl', 'tc', 'tr', 'ml', 'mc', 'mr', 'bl', 'bc', 'br']

/* 噪点纹理：每个噪点的 id 与 Tailwind 定位 className */
export const NOISE_DOTS = [
  { id: 'n1', className: 'left-1 top-1 size-0.5' },
  { id: 'n2', className: 'left-3 top-0.5 size-1' },
  { id: 'n3', className: 'right-1.5 top-2 size-0.5' },
  { id: 'n4', className: 'left-2 top-2.5 size-1' },
  { id: 'n4b', className: 'left-4 top-2.5 size-0.5' },
  { id: 'n5', className: 'right-2.5 top-3.5 size-0.5' },
  { id: 'n6', className: 'left-1 top-4 size-0.5' },
  { id: 'n7', className: 'left-3.5 top-4.5 size-1' },
  { id: 'n8', className: 'right-1.5 top-5 size-0.5' },
  { id: 'n8b', className: 'left-2.5 top-5.5 size-0.5' },
  { id: 'n9', className: 'left-1.5 bottom-2 size-1' },
  { id: 'n10', className: 'left-3 bottom-1 size-0.5' },
  { id: 'n11', className: 'right-3 bottom-2.5 size-0.5' },
  { id: 'n12', className: 'right-1 bottom-1.5 size-1' },
  { id: 'n13', className: 'left-4.5 bottom-3 size-0.5' },
  { id: 'n14', className: 'right-4 bottom-1 size-0.5' },
]

/* ASCII 纹理：行字符配置 */
export const ASCII_ROWS = [
  [
    { id: 'a1', char: 'J' },
    { id: 'a2', char: '8' },
    { id: 'a3', char: '#' },
  ],
  [
    { id: 'b1', char: 'x' },
    { id: 'b2', char: 'Y' },
    { id: 'b3', char: '*' },
  ],
  [
    { id: 'c1', char: '#' },
    { id: 'c2', char: '8' },
    { id: 'c3', char: 'X' },
  ],
]

/* 油彩纹理：斑块的 Tailwind 定位 className */
export const OIL_PATCHES = [
  'left-0 top-0 h-2.5 w-3',
  'left-2 top-1 h-3 w-3.5',
  'right-0 top-0.5 h-2 w-2.5',
  'left-0.5 bottom-1 h-2.5 w-4',
  'right-1 bottom-0 h-3 w-3',
]
