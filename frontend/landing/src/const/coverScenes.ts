import center from './scenes/center'
import l1 from './scenes/l1'
import l2 from './scenes/l2'
import l3 from './scenes/l3'
import l4 from './scenes/l4'
import r1 from './scenes/r1'
import r2 from './scenes/r2'
import r3 from './scenes/r3'
import r4 from './scenes/r4'

export type { TLandingScene as TCoverScene } from './scenes/shared'

/** Fixed refresh order; scenes rotate visually without changing their source file. */
export const COVER_SCENES = [l4, l3, l2, l1, center, r1, r2, r3, r4] as const
