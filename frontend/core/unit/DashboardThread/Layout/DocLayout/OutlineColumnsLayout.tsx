import useSalon from '../../salon/layout/doc_layout/outline_columns_layout'

export default function OutlineColumnsLayout() {
  const s = useSalon()

  return (
    <div className={s.block}>
      <div className={s.grid}>
        <div className={s.column}>
          <div className={s.group}>
            <div className={s.titleLg} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>

          <div className={s.columnGap} />
          <div className={s.group}>
            <div className={s.titleLg} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>
          <div className={s.columnGap} />

          <div className={s.group}>
            <div className={s.titleMd} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>
        </div>

        <div className={s.centerColumn}>
          <div className={s.group}>
            <div className={s.titleLg} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>

          <div className={s.columnGap} />
          <div className={s.group}>
            <div className={s.titleMd} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>

          <div className={s.columnGap} />

          <div className={s.group}>
            <div className={s.titleMd} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>
          <div className={s.columnGap} />
          <div className={s.group}>
            <div className={s.titleMd} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>
        </div>

        <div className={s.rightColumn}>
          <div className={s.group}>
            <div className={s.titleMd} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>

          <div className={s.columnGap} />

          <div className={s.group}>
            <div className={s.titleSm} />
            <div className={s.entry}>
              <div className={s.entryLabelLg} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
            <div className={s.entry}>
              <div className={s.entryLabelMd} />
              <div className={s.entryLine} />
              <div className={s.entryNum} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
