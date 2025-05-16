export const GET = async () => {
  const data = await fetch('https://api.vercel.app/blog', {
    next: { revalidate: 60 }, // 服务端缓存
  })
  // return Response.json(data)
  return Response.json(data)
}
