// app/post/layout.tsx
export default ({ children, previewer }) => {
  return (
    <div>
      {children}

      {previewer && <>{previewer}</>}
    </div>
  )
}
