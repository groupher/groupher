import useTwBelt from '~/hooks/useTwBelt'

export { cn } from '~/css'

type TProps = {
  active: boolean
  name: string
}

export default function useSalon({ active, name }: TProps) {
  const { cn, fg } = useTwBelt()

  return {
    wrapper: cn(
      'column w-40 h-24 pt-2 pb-2 px-2 pointer group',
      'keyboard-block',
      !active && 'shadow-none',
    ),
    iconBox: cn(
      'size-10 align-both mb-2 opacity-80 group-hover:opacity-100',
      active ? 'saturate-100' : 'saturate-0',
    ),
    intro: cn('ml-2 text-xs', fg('digest')),
    title: cn(
      'text-sm bold mr-1 group-hover:opacity-100',
      fg('title'),
      name === 'TypeScript' && 'group-hover:text-[#6eadf5]',
      name === 'React' && 'group-hover:text-[#7AC2DD]',
      name === 'PostgreSQL' && 'group-hover:text-[#40668E]',
      name === 'Notes' && 'group-hover:text-[#F2D049]',
      name === 'TailwindCSS' && 'group-hover:text-[#62BAF3]',
      name === 'Slate' && 'group-hover:text-[#AFAFAF]',
      name === 'Phoenix' && 'group-hover:text-[#EA5C29]',
      name === 'GraphQL' && 'group-hover:text-[#f65ac4]',
      name === 'Elixir' && 'group-hover:text-[#b16bb1]',
      name === 'Next.js' && 'group-hover:text-white group-hover:bg-black',
    ),
    techIcon: 'size-8 block',
  }
}
