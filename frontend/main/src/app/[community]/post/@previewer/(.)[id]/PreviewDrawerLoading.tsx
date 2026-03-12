export default function PreviewDrawerLoading() {
  return (
    <div className='min-h-full px-20'>
      <div className='my-5 flex h-9 items-center pl-0.5'>
        <div className='mr-1.5 h-7 w-7 rounded bg-divider' />
        <div className='h-2 w-2 rounded-full bg-divider' />
        <div className='grow' />
        <div className='h-7 w-7 rounded bg-divider' />
        <div className='ml-2 h-7 w-7 rounded bg-divider' />
        <div className='ml-2 h-7 w-7 rounded bg-divider' />
        <div className='mx-2.5 h-6 w-px bg-divider' />
        <div className='h-7 w-7 rounded bg-divider' />
        <div className='ml-2 h-7 w-7 rounded bg-divider' />
      </div>

      <div className='mb-1.5 flex h-12 items-center gap-3'>
        <div className='h-8 w-36 rounded-xl bg-divider' />
        <div className='h-7 w-24 rounded-xl bg-divider' />
        <div className='h-7 w-20 rounded-xl bg-divider' />
      </div>

      <div className='relative ml-0.5'>
        <div className='mb-3 h-14 w-9/12 rounded bg-divider' />
        <div className='absolute top-1 right-0 h-10 w-20 rounded bg-divider' />
      </div>

      <div className='mt-2 flex h-20 items-center border-b border-divider pb-3'>
        <div className='flex h-16 w-32 items-center justify-center rounded-2xl border border-divider'>
          <div className='h-8 w-16 rounded bg-divider' />
        </div>
        <div className='grow' />
        <div className='flex items-center gap-4'>
          <div className='h-6 w-20 rounded bg-divider' />
          <div className='h-6 w-20 rounded bg-divider' />
        </div>
      </div>

      <div className='mt-6 mb-3.5 space-y-4'>
        <div className='h-5 w-full rounded bg-divider' />
        <div className='h-5 w-11/12 rounded bg-divider' />
        <div className='h-5 w-full rounded bg-divider' />
        <div className='h-5 w-10/12 rounded bg-divider' />
        <div className='h-5 w-full rounded bg-divider' />
        <div className='h-5 w-9/12 rounded bg-divider' />
      </div>

      <div className='mt-8'>
        <div className='mb-4 h-8 w-48 rounded bg-divider' />

        <div className='rounded-2xl border border-divider p-5'>
          <div className='mb-4 flex items-center gap-3'>
            <div className='h-9 w-9 rounded-full bg-divider' />
            <div className='space-y-2'>
              <div className='h-4 w-24 rounded bg-divider' />
              <div className='h-3 w-16 rounded bg-divider' />
            </div>
          </div>

          <div className='space-y-3'>
            <div className='h-4 w-full rounded bg-divider' />
            <div className='h-4 w-10/12 rounded bg-divider' />
          </div>
        </div>
      </div>
    </div>
  )
}
