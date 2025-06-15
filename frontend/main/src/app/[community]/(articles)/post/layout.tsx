// app/post/layout.tsx
export default ({ children, modal }) => {
  console.log('## Modal content:', modal) // 现在应该能打印出内容

  return (
    <div>
      {children}

      {modal && <>{modal}</>}
    </div>
  )
}
