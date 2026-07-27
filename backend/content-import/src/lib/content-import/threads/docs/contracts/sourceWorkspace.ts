export type TSourceFile = {
  path: string
  sizeBytes: number
}

export type TSourceWorkspace = {
  files: readonly TSourceFile[]
  readText: (path: string) => Promise<string>
  revision: string
}
