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

type TDomainVerifyStatus = 'verifying' | 'verified' | 'failed'

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
  // { url: 'docs.groupher.com', status: 'failed', addedAt: '2026-01-13' },
]

export enum STEPS {
  ADD_DOMAIN = 'add_domain',
  DNS_SETUP = 'dns_setup',
  VERIFY_DOMAIN = 'verify_domain',
}

export type TStep = STEPS

export const DOMAIN_STEP_ORDER = [STEPS.ADD_DOMAIN, STEPS.DNS_SETUP, STEPS.VERIFY_DOMAIN] as const

export type TDomainStep = (typeof DOMAIN_STEP_ORDER)[number]
