'use client'

import useTwBelt from '~/hooks/useTwBelt'

export default function PreviewDrawerLoading() {
  const { bg, br, cn } = useTwBelt()
  const dividerBg = bg('divider')
  const dividerBr = br('divider')

  return (
    <div className='min-h-full px-20'>
      <div className='my-5 flex h-9 items-center pl-0.5'>
        <div className={cn(dividerBg, 'mr-1.5 size-7 rounded')} />
        <div className={cn(dividerBg, 'size-2 rounded-full')} />
        <div className='grow' />
        <div className={cn(dividerBg, 'size-7 rounded')} />
        <div className={cn(dividerBg, 'ml-2 size-7 rounded')} />
        <div className={cn(dividerBg, 'ml-2 size-7 rounded')} />
        <div className={cn(dividerBg, 'mx-2.5 h-6 w-px')} />
        <div className={cn(dividerBg, 'size-7 rounded')} />
        <div className={cn(dividerBg, 'ml-2 size-7 rounded')} />
      </div>

      <div className='mb-1.5 flex h-12 items-center gap-3'>
        <div className={cn(dividerBg, 'h-8 w-36 rounded-xl')} />
        <div className={cn(dividerBg, 'h-7 w-24 rounded-xl')} />
        <div className={cn(dividerBg, 'h-7 w-20 rounded-xl')} />
      </div>

      <div className='relative ml-0.5'>
        <div className={cn(dividerBg, 'mb-3 h-14 w-9/12 rounded')} />
        <div className={cn(dividerBg, 'absolute top-1 right-0 h-10 w-20 rounded')} />
      </div>

      <div className={cn(dividerBr, 'mt-2 flex h-20 items-center border-b pb-3')}>
        <div
          className={cn(dividerBr, 'flex h-16 w-32 items-center justify-center rounded-2xl border')}
        >
          <div className={cn(dividerBg, 'h-8 w-16 rounded')} />
        </div>
        <div className='grow' />
        <div className='flex items-center gap-4'>
          <div className={cn(dividerBg, 'h-6 w-20 rounded')} />
          <div className={cn(dividerBg, 'h-6 w-20 rounded')} />
        </div>
      </div>

      <div className='mt-6 mb-3.5 space-y-4'>
        <div className={cn(dividerBg, 'h-5 w-full rounded')} />
        <div className={cn(dividerBg, 'h-5 w-11/12 rounded')} />
        <div className={cn(dividerBg, 'h-5 w-full rounded')} />
        <div className={cn(dividerBg, 'h-5 w-10/12 rounded')} />
        <div className={cn(dividerBg, 'h-5 w-full rounded')} />
        <div className={cn(dividerBg, 'h-5 w-9/12 rounded')} />
      </div>

      <div className='mt-8'>
        <div className={cn(dividerBg, 'mb-4 h-8 w-48 rounded')} />

        <div className={cn(dividerBr, 'rounded-2xl border p-5')}>
          <div className='mb-4 flex items-center gap-3'>
            <div className={cn(dividerBg, 'size-9 rounded-full')} />
            <div className='space-y-2'>
              <div className={cn(dividerBg, 'h-4 w-24 rounded')} />
              <div className={cn(dividerBg, 'h-3 w-16 rounded')} />
            </div>
          </div>

          <div className='space-y-3'>
            <div className={cn(dividerBg, 'h-4 w-full rounded')} />
            <div className={cn(dividerBg, 'h-4 w-10/12 rounded')} />
          </div>
        </div>
      </div>
    </div>
  )
}
