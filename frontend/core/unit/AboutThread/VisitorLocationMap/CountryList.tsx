import type { FC } from 'react'

import useTrans from '~/hooks/useTrans'
import type { TVisitorLocationCountry } from '~/spec'

import useSalon from './salon'

type TProps = {
  countries: TVisitorLocationCountry[]
  fullWidth?: boolean
}

const CountryList: FC<TProps> = ({ countries, fullWidth = false }) => {
  const s = useSalon()
  const { t, locale } = useTrans()
  const numberFormat = new Intl.NumberFormat(locale)

  return (
    <div className={fullWidth ? s.listFull : s.list}>
      {countries.map((country) => (
        <div key={country.code} className={s.row}>
          <div className={s.rowHeader}>
            <span className={s.country}>{country.label}</span>
            <span className={s.percentage}>{country.percentage.toFixed(1)}%</span>
          </div>
          <div className={s.visitors}>
            {t('about.visitor_location.visitors', {
              count: numberFormat.format(country.visitors),
            })}
          </div>
          <div className={s.track} aria-hidden='true'>
            <div className={s.fill} style={{ width: `${Math.min(country.percentage, 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  )
}

export default CountryList
