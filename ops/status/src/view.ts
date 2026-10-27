import { PROBES } from './probes'
import type { State, StatusRow } from './state'

const STALE_AFTER_MS = 6 * 60_000

type VisibleStatus = {
  state: State | 'unknown'
  checkedAt: string | null
  responseMs: number | null
}

export function visibleStatus(row: StatusRow | undefined, now: Date): VisibleStatus {
  if (
    !row ||
    !Number.isFinite(Date.parse(row.checked_at)) ||
    now.getTime() - Date.parse(row.checked_at) > STALE_AFTER_MS
  ) {
    return { state: 'unknown', checkedAt: row?.checked_at ?? null, responseMs: null }
  }
  return { state: row.state, checkedAt: row.checked_at, responseMs: row.response_ms }
}

const labels: Record<VisibleStatus['state'], string> = {
  up: 'Operational',
  degraded: 'Checking',
  down: 'Unavailable',
  unknown: 'No recent check',
}

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char,
  )

export function statusPayload(rows: Map<string, StatusRow>, now: Date) {
  const services = PROBES.map((probe) => ({
    id: probe.id,
    name: probe.label,
    group: probe.group,
    ...visibleStatus(rows.get(probe.id), now),
  }))
  const overall: VisibleStatus['state'] = services.some((service) => service.state === 'down')
    ? 'down'
    : services.some((service) => service.state === 'degraded')
      ? 'degraded'
      : services.some((service) => service.state === 'unknown')
        ? 'unknown'
        : 'up'
  return { overall, services, generatedAt: now.toISOString() }
}

export function renderPage(rows: Map<string, StatusRow>, now: Date): string {
  const payload = statusPayload(rows, now)
  const groups = ['Platform', 'Applications'] as const
  const cards = groups
    .map(
      (group) => `
    <section aria-label="${group}">
      <h2>${group}</h2>
      <div class="service-list">${payload.services
        .filter((service) => service.group === group)
        .map(
          (service) => `
        <div class="service">
          <span class="name">${escapeHtml(service.name)}</span>
          <span class="status ${service.state}"><span class="dot" aria-hidden="true"></span>${labels[service.state]}</span>
        </div>`,
        )
        .join('')}
      </div>
    </section>`,
    )
    .join('')

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><meta http-equiv="refresh" content="120">
<title>Groupher Status</title>
<style>
:root{color-scheme:light;font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:#f6f8f7;color:#16241c}
*{box-sizing:border-box}body{margin:0}main{max-width:760px;margin:0 auto;padding:48px 20px 72px}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:46px}
.brand{font-weight:750;font-size:19px;letter-spacing:-.04em;color:#16241c;text-decoration:none}.eyebrow{font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#65776b}
h1{font-size:clamp(34px,6vw,54px);letter-spacing:-.055em;line-height:1.08;margin:12px 0 16px}p{line-height:1.6;color:#65776b;margin:0}
.summary{background:#fff;border:1px solid #dce5df;border-radius:20px;padding:26px 28px;box-shadow:0 12px 34px #1b46300a;margin:32px 0 40px;display:flex;align-items:center;gap:17px}
.summary .dot{width:15px;height:15px}.summary strong{font-size:18px}.summary small{display:block;color:#65776b;margin-top:4px}
h2{font-size:14px;letter-spacing:.06em;text-transform:uppercase;color:#65776b;margin:30px 2px 12px}
.service-list{background:#fff;border:1px solid #dce5df;border-radius:16px;overflow:hidden}.service{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:19px 22px;border-top:1px solid #edf1ee}.service:first-child{border-top:0}.name{font-weight:620}.status{display:inline-flex;align-items:center;gap:9px;color:#267548;font-size:13px;font-weight:650;white-space:nowrap}.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#36a66a}.status.degraded,.status.unknown{color:#9a6b16}.degraded .dot,.unknown .dot,.dot.degraded,.dot.unknown{background:#e6ad3c}.status.down{color:#b53b3b}.down .dot,.dot.down{background:#de5c5c}
footer{margin-top:36px;font-size:12px;color:#718076}footer a{color:inherit}
@media(max-width:480px){main{padding-top:32px}.service{padding:17px 16px}.status{font-size:12px}}
</style></head><body><main>
<header><a class="brand" href="https://groupher.com/">Groupher</a><span class="eyebrow">System status</span></header>
<p class="eyebrow">Live service checks</p><h1>Current availability</h1>
<p>Front-end services are checked every two minutes. Backend services are intentionally excluded.</p>
<div class="summary"><span class="dot ${payload.overall}" aria-hidden="true"></span><div><strong>${labels[payload.overall]}</strong><small>Last view: ${escapeHtml(now.toISOString())}</small></div></div>
${cards}<footer>Results become unknown if checks stop for more than six minutes. <a href="/api/status">JSON status</a></footer>
</main></body></html>`
}
