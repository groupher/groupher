export default function PreviewDrawerLoading() {
  return (
    <div className='min-h-full px-20'>
      <div className='my-5 flex h-9 items-center pl-0.5'>
        <div className='bg-divider mr-1.5 h-7 w-7 rounded' />
        <div className='bg-divider h-2 w-2 rounded-full' />
        <div className='grow' />
        <div className='bg-divider h-7 w-7 rounded' />
        <div className='bg-divider ml-2 h-7 w-7 rounded' />
        <div className='bg-divider ml-2 h-7 w-7 rounded' />
        <div className='bg-divider mx-2.5 h-6 w-px' />
        <div className='bg-divider h-7 w-7 rounded' />
        <div className='bg-divider ml-2 h-7 w-7 rounded' />
      </div>

      <div className='mb-1.5 flex h-12 items-center gap-3'>
        <div className='bg-divider h-8 w-36 rounded-xl' />
        <div className='bg-divider h-7 w-24 rounded-xl' />
        <div className='bg-divider h-7 w-20 rounded-xl' />
      </div>

      <div className='relative ml-0.5'>
        <div className='bg-divider mb-3 h-14 w-9/12 rounded' />
        <div className='bg-divider absolute top-1 right-0 h-10 w-20 rounded' />
      </div>

      <div className='border-divider mt-2 flex h-20 items-center border-b pb-3'>
        <div className='border-divider flex h-16 w-32 items-center justify-center rounded-2xl border'>
          <div className='bg-divider h-8 w-16 rounded' />
        </div>
        <div className='grow' />
        <div className='flex items-center gap-4'>
          <div className='bg-divider h-6 w-20 rounded' />
          <div className='bg-divider h-6 w-20 rounded' />
        </div>
      </div>

      <div className='mt-6 mb-3.5 space-y-4'>
        <div className='bg-divider h-5 w-full rounded' />
        <div className='bg-divider h-5 w-11/12 rounded' />
        <div className='bg-divider h-5 w-full rounded' />
        <div className='bg-divider h-5 w-10/12 rounded' />
        <div className='bg-divider h-5 w-full rounded' />
        <div className='bg-divider h-5 w-9/12 rounded' />
      </div>

      <div className='mt-8'>
        <div className='bg-divider mb-4 h-8 w-48 rounded' />

        <div className='border-divider rounded-2xl border p-5'>
          <div className='mb-4 flex items-center gap-3'>
            <div className='bg-divider h-9 w-9 rounded-full' />
            <div className='space-y-2'>
              <div className='bg-divider h-4 w-24 rounded' />
              <div className='bg-divider h-3 w-16 rounded' />
            </div>
          </div>

          <div className='space-y-3'>
            <div className='bg-divider h-4 w-full rounded' />
            <div className='bg-divider h-4 w-10/12 rounded' />
          </div>
        </div>
      </div>
    </div>
  )
}
