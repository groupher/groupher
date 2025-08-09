export default ({ children }) => {
  return (
    <div className='w-screen h-screen p-24 align-both'>
      <div className='w-full h-full rounded-lg align-both debug'>{children}</div>
    </div>
  )
}
