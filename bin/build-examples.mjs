#!/usr/bin/env node
/**
 * Generates public/data/examples.json: the "Examples" gallery used by the
 * static (GitHub Pages) build, where there is no "examples" user account.
 *
 * Every slice type and variant is validated against the segment catalog so
 * an example can never reference a part that does not exist.
 *
 * Usage: node bin/build-examples.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import { load, JSON_SCHEMA } from 'js-yaml'

const root = path.resolve(import.meta.dirname, '..')
const lookup = load(
  fs.readFileSync(path.join(root, 'packages/parts/data/segment-lookup.yaml'), 'utf8'),
  { schema: JSON_SCHEMA }
)
const boundaries = load(
  fs.readFileSync(path.join(root, 'packages/parts/data/boundary_defs.yaml'), 'utf8'),
  { schema: JSON_SCHEMA }
)

const SCHEMA_VERSION = 35
const CREATED = '2026-10-03T00:00:00.000Z'
let counter = 0
const id = (prefix) => `${prefix}${(++counter).toString(36).padStart(6, '0')}`

function slice(type, variantString, width, elevation = 0) {
  const seg = lookup[type]
  if (!seg) throw new Error(`Unknown slice type: ${type}`)
  if (!seg.details || !(variantString in seg.details)) {
    throw new Error(`Unknown variant for ${type}: ${variantString}`)
  }
  return {
    id: id('ex'),
    type,
    variantString,
    width,
    elevation,
    slope: { on: false, values: [] },
  }
}

function boundary(variant, floors) {
  if (!(variant in boundaries)) throw new Error(`Unknown boundary: ${variant}`)
  return { id: id('bd'), variant, floors, elevation: 1 }
}

function street(namespacedId, name, segments, left, right, skybox = 'day') {
  const width = Math.round(segments.reduce((a, s) => a + s.width, 0) * 100) / 100
  return {
    id: `examples-${namespacedId}`,
    namespacedId,
    name,
    clientUpdatedAt: CREATED,
    createdAt: CREATED,
    updatedAt: CREATED,
    originalStreetId: null,
    creatorId: 'examples',
    data: {
      street: {
        schemaVersion: SCHEMA_VERSION,
        units: 0,
        width,
        segments,
        boundary: { left, right },
        skybox,
        weather: null,
        location: null,
        showAnalytics: false,
        userUpdated: true,
        editCount: 1,
        name,
      },
      plugins: {},
    },
  }
}

const streets = [
  street(
    1,
    'Complete street with protected bike lanes',
    [
      slice('sidewalk', 'normal', 2.4, 1),
      slice('sidewalk-tree', 'big', 1.2, 1),
      slice('bike-lane', 'inbound|green|road', 1.8),
      slice('divider', 'bollard', 0.6),
      slice('drive-lane', 'inbound|car', 3.2),
      slice('turn-lane', 'inbound|left', 3),
      slice('drive-lane', 'outbound|car', 3.2),
      slice('divider', 'bollard', 0.6),
      slice('bike-lane', 'outbound|green|road', 1.8),
      slice('sidewalk-tree', 'big', 1.2, 1),
      slice('sidewalk', 'normal', 2.4, 1),
    ],
    boundary('residential', 4),
    boundary('narrow', 3)
  ),
  street(
    2,
    'Transit boulevard with bus lanes',
    [
      slice('sidewalk', 'dense', 3, 1),
      slice('transit-shelter', 'left|street-level', 2.4, 1),
      slice('bus-lane', 'inbound|colored|typical', 3.4),
      slice('drive-lane', 'inbound|car', 3.2),
      slice('divider', 'big-tree', 2),
      slice('drive-lane', 'outbound|car', 3.2),
      slice('bus-lane', 'outbound|colored|typical', 3.4),
      slice('transit-shelter', 'right|street-level', 2.4, 1),
      slice('sidewalk', 'dense', 3, 1),
    ],
    boundary('wide', 6),
    boundary('wide', 6)
  ),
  street(
    3,
    'Light rail avenue',
    [
      slice('sidewalk', 'normal', 3, 1),
      slice('sidewalk-lamp', 'right|traditional', 0.6, 1),
      slice('drive-lane', 'inbound|car', 3.2),
      slice('light-rail', 'inbound|grass', 3.2),
      slice('light-rail', 'outbound|grass', 3.2),
      slice('drive-lane', 'outbound|car', 3.2),
      slice('sidewalk-lamp', 'left|traditional', 0.6, 1),
      slice('sidewalk', 'normal', 3, 1),
    ],
    boundary('residential', 5),
    boundary('residential', 5)
  ),
  street(
    4,
    'Neighbourhood street with parking',
    [
      slice('sidewalk', 'sparse', 1.8, 1),
      slice('sidewalk-tree', 'big', 0.9, 1),
      slice('parking-lane', 'inbound|left', 2.2),
      slice('drive-lane', 'inbound|sharrow', 3),
      slice('drive-lane', 'outbound|sharrow', 3),
      slice('parking-lane', 'outbound|right', 2.2),
      slice('sidewalk-tree', 'big', 0.9, 1),
      slice('sidewalk', 'sparse', 1.8, 1),
    ],
    boundary('narrow', 2),
    boundary('narrow', 2)
  ),
  street(
    5,
    'Pedestrian street',
    [
      slice('sidewalk', 'dense', 3, 1),
      slice('sidewalk-bench', 'left', 1.2, 1),
      slice('sidewalk-tree', 'big', 1.2, 1),
      slice('sidewalk', 'dense', 4, 1),
      slice('sidewalk-tree', 'big', 1.2, 1),
      slice('sidewalk-bench', 'right', 1.2, 1),
      slice('sidewalk', 'dense', 3, 1),
    ],
    boundary('residential', 4),
    boundary('residential', 4)
  ),
]

const out = path.join(root, 'public/data/examples.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify({ streets }, null, 1) + '\n')
console.log(`Wrote ${streets.length} examples to ${path.relative(root, out)}`)
