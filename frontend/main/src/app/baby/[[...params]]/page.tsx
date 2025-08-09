export default () => {
  return (
    <div className='rounded-lg w-96 h-96 debug-g align-both'>
      <div>
        <h2 className='mb-5 bold'>Zustand text</h2>
        <ul>
          <li>- 不使用 context 初始化状态</li>
          <li>- 在 layout 上初始化状态</li>
          <li>- 在 page SSR 上修改状态</li>
          <li>- 在 page client 上修改状态</li>
        </ul>
      </div>
    </div>
  )
}
