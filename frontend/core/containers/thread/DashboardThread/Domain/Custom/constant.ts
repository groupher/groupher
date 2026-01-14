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

export type TDomainVerifyStatus = 'verifying' | 'verified' | 'failed'

export type TVerifyingDomainRow = {
  url: string
  status: TDomainVerifyStatus
  addedAt?: string | null // ISO string or null (use '-' in UI)
}

export const VERIFYING_DOMAIN_ROWS: TVerifyingDomainRow[] = [
  {
    url: 'groupher.com',
    status: 'verifying',
    addedAt: null,
  },
  // optional: add more rows for UI testing
  // { url: 'www.groupher.com', status: 'verified', addedAt: '2026-01-14' },
  // { url: 'docs.groupher.com', status: 'failed', addedAt: '2026-01-13' },
]
