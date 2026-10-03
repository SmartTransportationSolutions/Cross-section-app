#!/usr/bin/env node
/**
 * Renders docs/feature-parity.md from docs/feature-parity.json so that the
 * human-readable matrix and the machine-readable contract never diverge.
 * Usage: node bin/generate-parity-md.mjs
 */
import fs from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const source = JSON.parse(fs.readFileSync(path.join(root, 'docs/feature-parity.json'), 'utf8'))
const { meta, features } = source

const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'IMPLEMENTED_UNVERIFIED', 'VERIFIED', 'BLOCKED']
const count = (key) =>
  Object.fromEntries(statuses.map((s) => [s, features.filter((f) => f[key] === s).length]))

const impl = count('implementationStatus')
const verif = count('verificationStatus')
const byCategory = {}
for (const f of features) {
  byCategory[f.category] ??= []
  byCategory[f.category].push(f)
}

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const list = (a) => (Array.isArray(a) && a.length ? a.map(esc).join('; ') : '—')

let md = `# STS Street feature-parity contract

Generated from \`docs/feature-parity.json\` by \`bin/generate-parity-md.mjs\` — edit the JSON, not this file.

- Reference: Streetmix at commit \`${meta.upstreamCommit}\` (${meta.referenceDate}); see \`docs/reference-baseline.md\`.
- Last updated: ${meta.updated}
- Statuses: NOT_STARTED, IN_PROGRESS, IMPLEMENTED_UNVERIFIED, VERIFIED, BLOCKED. In the **Impl.** column VERIFIED means the code is present and reviewed on the STS tree; the **Verif.** column is VERIFIED only when the row's acceptance evidence was executed against the STS application with its real backend and database (IMPLEMENTED_UNVERIFIED there means the evidence exists as a test but has not been executed and recorded yet, or only unit-level evidence exists).
- Scope reductions require explicit approval and stay visible in the audit history (section "Deviations and reductions" below).

## Totals

| | ${statuses.join(' | ')} | Total |
| --- | ${statuses.map(() => '---').join(' | ')} | --- |
| Implementation | ${statuses.map((s) => impl[s]).join(' | ')} | ${features.length} |
| Verification | ${statuses.map((s) => verif[s]).join(' | ')} | ${features.length} |

Blocked rows: ${features.filter((f) => f.implementationStatus === 'BLOCKED' || f.verificationStatus === 'BLOCKED').map((f) => f.id).join(', ') || 'none'}

`

for (const [category, rows] of Object.entries(byCategory)) {
  md += `## ${category}\n\n`
  md += `| ID | Capability | Roles | Interactions / expected result | Persistence, permissions, errors | Reference evidence | STS implementation | Tests / evidence | Impl. | Verif. | Blocker / notes |\n`
  md += `| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |\n`
  for (const f of rows) {
    md += `| ${f.id} | ${esc(f.capability)} | ${esc(f.roles)} | ${esc(f.interactions)} ⇒ ${esc(f.expected)} | ${esc(f.persistence)} | ${esc(f.reference)} | ${esc(f.implementation)}${f.substitution ? ` — substitution: ${esc(f.substitution)}` : ''} | ${list(f.tests)}${f.evidence?.length ? ` — evidence: ${list(f.evidence)}` : ''} | ${f.implementationStatus} | ${f.verificationStatus} | ${esc([f.blocker, f.notes].filter(Boolean).join(" "))} |\n`
  }
  md += '\n'
}

md += `## Deviations and reductions (audit history)\n\n`
for (const d of meta.deviations) {
  md += `- **${d.date} — ${d.id}:** ${d.text}\n`
}

fs.writeFileSync(path.join(root, 'docs/feature-parity.md'), md)
console.log(`Wrote docs/feature-parity.md: ${features.length} features; implementation ${JSON.stringify(impl)}; verification ${JSON.stringify(verif)}`)
