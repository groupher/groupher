import LavaLampLoading from '~/widgets/Loading/LavaLampLoading'

import PreviewDrawerShell from './PreviewDrawerShell'

export default function PreviewDrawerLoading() {
  return (
    <PreviewDrawerShell dismissible={false}>
      <div className='flex min-h-full flex-col gap-6 px-6 py-7 md:px-8 md:py-8'>
        <div className='flex items-start justify-between gap-4 border-b border-divider pb-5'>
          <div className='flex-1'>
            <div className='mb-3 h-4 w-24 rounded bg-divider' />
            <div className='mb-3 h-8 w-4/5 max-w-2xl rounded bg-divider' />
            <div className='h-4 w-2/5 rounded bg-divider' />
          </div>
          <div className='h-10 w-10 rounded-full bg-divider' />
        </div>

        <div className='space-y-3'>
          <div className='h-4 w-full rounded bg-divider' />
          <div className='h-4 w-full rounded bg-divider' />
          <div className='h-4 w-11/12 rounded bg-divider' />
          <div className='h-4 w-4/5 rounded bg-divider' />
        </div>

        <div className='mt-3 rounded border border-divider p-4'>
          <div className='mb-4 h-4 w-28 rounded bg-divider' />
          <div className='flex justify-center py-10'>
            <LavaLampLoading top={0} left={0} />
          </div>
        </div>
      </div>
    </PreviewDrawerShell>
  )
}
