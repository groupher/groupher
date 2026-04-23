import useBaseSalon from './cover_thumb_base'

export default function useSalon() {
  const base = useBaseSalon()

  return {
    block: base.block,
    cardsRows: base.cardsRows,
    cardsRow: base.cardsRow,
    cardBox: base.cardBox,
    cardBody: base.cardBody,
    cardFooter: base.cardFooter,
    cardFooterBar: base.cardFooterBar,
    bar: base.bar,
  }
}
