export type TDnsRecord = {
  type: 'A' | 'TXT' | 'CNAME'
  host: string
  value: string
}

export const DNS_RECORDS: TDnsRecord[] = [
  {
    type: 'A',
    host: '@',
    value: '76.76.21.21',
  },
  {
    type: 'TXT',
    host: '_vercel',
    value: 'vc-domain-verify=groupher.com,47085e7b4e26138313ce',
  },
]
