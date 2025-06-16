// app/post/layout.tsx
export default ({ children, modal }) => {
  return (
    <div>
      {children}

      {modal && <>{modal}</>}
    </div>
  )
}
