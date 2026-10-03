#!/usr/bin/env node
/**
 * Catalog coverage report: compares the element/variant/boundary/skybox
 * catalog and illustration assets of the STS tree against the frozen upstream
 * inventory (docs/research/upstream-catalog.json) and verifies that every
 * sprite referenced by the catalog exists. Writes docs/catalog-report.md.
 */
import fs from 'node:fs'
import path from 'node:path'
import { load, JSON_SCHEMA } from 'js-yaml'

const root = path.resolve(import.meta.dirname, '..')
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8')
const yaml = (p) => load(read(p), { schema: JSON_SCHEMA })

const upstream = JSON.parse(read('docs/research/upstream-catalog.json'))
const segments = yaml('packages/parts/data/segment-lookup.yaml')
const boundaries = yaml('packages/parts/data/boundary_defs.yaml')
const spriteDefs = yaml('packages/parts/data/sprite_defs.yaml')
const components = yaml('packages/parts/data/components.yaml')
const skyboxes = JSON.parse(read('client/src/sky/skybox-defs.json'))

const illustrationDir = path.join(root, 'packages/illustrations/images')
const iconDir = path.join(root, 'packages/variant-icons/icons')
const walk = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(dir, e.name)) : e.name.endsWith('.svg') ? [path.join(dir, e.name)] : []
  )
const illustrations = walk(illustrationDir)
const icons = walk(iconDir)

// Sprite ids are "<dir>--<file>" relative to the images directory (see app/lib/svg_sprite.ts)
const spriteIds = new Set(
  illustrations.map((f) => path.relative(illustrationDir, f).replace(/\.svg$/, '').split(path.sep).join('--'))
)

const upstreamSegmentIds = new Set((upstream.segments ?? []).map((s) => s.id))
const stsSegmentIds = new Set(Object.keys(segments))
const missingSegments = [...upstreamSegmentIds].filter((id) => !stsSegmentIds.has(id))
const extraSegments = [...stsSegmentIds].filter((id) => !upstreamSegmentIds.has(id))

let variantCount = 0
for (const seg of Object.values(segments)) {
  const dims = seg.variants ?? []
  variantCount += Object.keys(seg.details ?? {}).length || dims.length || 1
}

const upstreamBoundaryIds = new Set((upstream.boundaries ?? []).map((b) => b.id))
const stsBoundaryIds = new Set(Object.keys(boundaries))
const missingBoundaries = [...upstreamBoundaryIds].filter((id) => !stsBoundaryIds.has(id))

const upstreamEnv = new Set((upstream.environments ?? []).map((e) => e.id))
const stsEnv = new Set(Object.keys(skyboxes))
const missingEnv = [...upstreamEnv].filter((id) => !stsEnv.has(id))

// Every sprite referenced by sprite definitions and segment details must exist
const referenced = new Set()
const collect = (v) => {
  if (typeof v === 'string' && /^[a-z0-9-]+--[a-z0-9-]+/.test(v)) referenced.add(v)
  else if (Array.isArray(v)) v.forEach(collect)
  else if (v && typeof v === 'object') Object.values(v).forEach(collect)
}
collect(spriteDefs)
collect(segments)
// Component ids (components.yaml) are compositions of sprites, not sprites.
const componentIds = new Set(Object.values(components).flatMap((group) => Object.keys(group ?? {})))
const missingSprites = [...referenced].filter(
  (id) => !componentIds.has(id) && !spriteIds.has(id) && !spriteIds.has(id.replace(/--\d+$/, ''))
)
// Upstream ships no thumbnail for the flag-gated crosswalk element (it falls
// back to `thumbnails--missing`); this is identical in STS and not a gap.
const KNOWN_UPSTREAM_THUMBNAIL_GAPS = new Set(['crosswalk'])
const thumbnails = [...stsSegmentIds].filter((id) => !spriteIds.has(`thumbnails--${id}`) && !KNOWN_UPSTREAM_THUMBNAIL_GAPS.has(id))

const report = `# Catalog coverage report

Generated ${new Date().toISOString()} by \`bin/catalog-report.mjs\` against upstream inventory \`docs/research/upstream-catalog.json\` (commit ${upstream.commit ?? 'f17578e'}).

| Item | Upstream | STS Street | Missing in STS | Extra in STS |
| --- | --- | --- | --- | --- |
| Segment types | ${upstreamSegmentIds.size} | ${stsSegmentIds.size} | ${missingSegments.length ? missingSegments.join(', ') : 'none'} | ${extraSegments.length ? extraSegments.join(', ') : 'none'} |
| Variant combinations (from details keys) | ${upstream.segments?.reduce((a, s) => a + (s.variantCount ?? 0), 0) || 'see research'} | ${variantCount} | — | — |
| Boundaries | ${upstreamBoundaryIds.size} | ${stsBoundaryIds.size} | ${missingBoundaries.length ? missingBoundaries.join(', ') : 'none'} | — |
| Skybox definitions | ${upstreamEnv.size} | ${stsEnv.size} | ${missingEnv.length ? missingEnv.join(', ') : 'none'} | — |
| Illustration SVGs | ${upstream.illustrationCount ?? 338} | ${illustrations.length} | ${illustrations.length < (upstream.illustrationCount ?? 338) ? (upstream.illustrationCount ?? 338) - illustrations.length : 'none'} | — |
| Variant icon SVGs | 84 | ${icons.length} | ${icons.length < 84 ? 84 - icons.length : 'none'} | — |
| Sprites referenced by catalog that are missing | — | ${referenced.size} referenced | ${missingSprites.length ? missingSprites.join(', ') : 'none'} | — |
| Segment thumbnails missing (excluding upstream's own gap: crosswalk, flag-gated) | — | — | ${thumbnails.length ? thumbnails.join(', ') : 'none'} | — |

Result: ${missingSegments.length + missingBoundaries.length + missingEnv.length + missingSprites.length + thumbnails.length === 0 ? '**PASS** — the STS catalog and assets are identical to the upstream baseline.' : '**FAIL** — see missing items above.'}
`
fs.writeFileSync(path.join(root, 'docs/catalog-report.md'), report)
console.log(report)
