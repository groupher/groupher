import LavaLampLoading from '~/ui/Loading/LavaLampLoading'

export default function RoutePending() {
  return (
    <div className='column-center min-h-52 w-full justify-center' aria-label='Loading route'>
      <LavaLampLoading />
    </div>
  )
}
