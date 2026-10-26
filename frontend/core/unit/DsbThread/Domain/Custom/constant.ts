import type { TDnsRecord, TStep, TVerifyingDomainRow } from './spec'

// The custom-domain wizard has no live provisioning backend. Keep DNS examples
// empty until Cloudflare custom-domain support exists.
export const DNS_RECORDS: TDnsRecord[] = []

export const VERIFYING_DOMAIN_ROWS: TVerifyingDomainRow[] = []

export enum STEPS {
  ADD_DOMAIN = 'add_domain',
  DNS_SETUP = 'dns_setup',
  VERIFY_DOMAIN = 'verify_domain',
}

export const DOMAIN_STEP_ORDER: TStep[] = [STEPS.ADD_DOMAIN, STEPS.DNS_SETUP, STEPS.VERIFY_DOMAIN]
