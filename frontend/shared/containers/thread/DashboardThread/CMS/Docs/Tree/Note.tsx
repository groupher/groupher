import useSalon from '../../../salon/cms/docs/tree/note'

export default () => {
  const s = useSalon()

  return (
    <div className={s.wrapper}>
      <div className={s.title}>操作提示</div>
      <ul className={s.ul}>
        <li className={s.li}>可通过拖拽改变文档或目录顺序。</li>
        <li className={s.li}>可通过键盘导航到任意文档。</li>
        <li className={s.li}>可选中某文档/目录后后在其下方创建新文档/目录。</li>
        <li className={s.li}>可通过键盘的删除键移除文档。</li>
        <li className={s.li}>删除目录会循环删除该目录下所有节点。</li>
        <li className={s.li}>可通过 "空格" 键打开/关闭目录。</li>
      </ul>
    </div>
  )
}
