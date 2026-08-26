import { QRCodeSVG } from 'qrcode.react'

export default function QRCode({ value }: { value: string }) {
  return <QRCodeSVG data-testid='menu-qr-code' value={value} size={72} />
}
