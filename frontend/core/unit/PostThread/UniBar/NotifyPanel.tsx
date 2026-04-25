import useSalon from './salon/notify_panel'

export default function NotifyPanel() {
  const s = useSalon()

  return <div className={s.wrapper}>当前没有消息。</div>
}
