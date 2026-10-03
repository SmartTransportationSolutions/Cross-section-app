# Streetmix element catalog — inventory

Source: `streetmix/streetmix` checkout at commit `f17578eec760d3c7b41216823ec32c7e8d04e8bc`
(read-only at `scratchpad/upstream-streetmix`). All paths below are relative to that checkout.
Machine-readable companion: `catalog.json` (same directory). Items marked **UNVERIFIED** were
inferred rather than confirmed by reading executing code.

Summary numbers: **38 segment types**, **223 variant combinations**, 7 lane components,
36 marking components, 28 object components, 20 vehicle components, 1 effect component,
**16 boundary types**, **10 skybox definitions (7 enabled)**, 2 weather effects,
**7 street templates**, **338 illustration SVGs**, **84 variant-icon SVGs**.

---

## 1. `packages/parts` — the "kit of parts"

### 1.1 Files and build pipeline

| Path | Role |
|---|---|
| `packages/parts/package.json` | `@streetmix/parts` v0.0.1, license **AGPL-3.0-or-later**, `main: build/index.js`. Scripts: `build:data` = `node scripts/generate-json-data.js`; `build` = `build:data && tsc`. |
| `packages/parts/data/segment-lookup.yaml` (4027 lines) | **Source of truth** for all segment ("slice") types, their rules and the component recipe of every variant. |
| `packages/parts/data/components.yaml` (1088 lines) | Component library grouped as `lanes`, `markings`, `objects`, `vehicles`, `effects`. Each component variant resolves to sprite graphics. |
| `packages/parts/data/sprite_defs.yaml` (136 lines) | Per-sprite overrides (`originY`, `offsetX`, `offsetY`) applied when a sprite id is drawn. |
| `packages/parts/data/boundary_defs.yaml` (170 lines) | Boundary ("building"/edge) definitions. |
| `packages/parts/scripts/generate-json-data.js` | Walks `data/` recursively; every `*.yaml`/`*.yml` is parsed with `js-yaml` (`JSON_SCHEMA`) and written as pretty-printed JSON to `src/data/<same path>.json`. No transformation other than YAML→JSON. |
| `packages/parts/src/data/` | Output directory. Only `README.md` is checked in ("generated from the data folder… Do not edit manually"); `*.json` is git-ignored (`packages/parts/.gitignore`). Not present in this checkout (needs `npm run build:data`). |
| `packages/parts/src/info.ts` | Runtime API (TypeScript): `SliceTypes`, `SEGMENT_UNKNOWN`, `SEGMENT_UNKNOWN_VARIANT`, `getAllSliceInfo()`/`getAllSegmentInfo()`, `getSliceInfo()`/`getSegmentInfo()`, `getSegmentVariantInfo(type, variantString)`, `getSpriteDef(idOrObj)`. |
| `packages/parts/src/segment-dict.js` | Component resolver: `getSegmentLookup`, `getSegmentComponentInfo`, `applySegmentInfoOverridesAndRules`, `getSegmentSprites`, `COMPONENT_GROUPS`. |
| `packages/parts/src/boundary.ts` | `getBoundaryItem(variant)` — throws `Unknown boundary variant` if not in `boundary_defs.json`. |
| `packages/parts/src/index.ts` | `export * from './boundary.js'; export * from './info.js'` |
| `packages/types/src/index.ts` | Type contract: `SegmentLookup`, `SegmentDefinition`, `SliceVariantDetails`, `VariantInfo`, `VariantGraphics`, `SpriteDefinition`, `BoundaryDefinition`, `SkyboxDefinition`, `Capacity*`, `StreetJson`, `Segment`/`SliceItem`, `SliceWarnings`, `MeasurementValues {metric: m, imperial: ft}`, `UnlockCondition = 'SIGN_IN' | 'SUBSCRIBE'`, `SlopeConstraints = 'off' | 'path' | 'berm'`. |

### 1.2 Segment definition schema (`segment-lookup.yaml` entry)

Top-level key = segment **type id** (used in street data `segments[].type`). Fields (per `SegmentLookup` type and `client/src/segments/README.md`):

| Field | Meaning |
|---|---|
| `name` | English display name (sentence case). |
| `nameKey` | i18n key → `segments.<nameKey>` in `packages/i18n/locales/*/segment-info.json`. |
| `owner` | Meta-category, one of `SliceTypes`: `NONE, CAR, TRANSIT, BIKE, PEDESTRIAN, FURNITURE, FLEX, UTILITY, WALL, DRAINAGE, NATURE` (`packages/parts/src/info.ts:34-46`). Used for analytics/visualisation, **not** for palette grouping (the palette is a flat list in YAML order). |
| `zIndex` | Canvas layering priority (higher draws over lower; ties → DOM order). |
| `coastmixPaletteOrder` | If present the segment appears in the **Coastmix** palette, sorted ascending by this value; segments without it are dropped from the palette when `COASTMIX_MODE` is on (`client/src/palette/PaletteItems.tsx:30-39`). |
| `defaultWidth` | `{metric, imperial}` — width given to a freshly dropped palette item (`getWidthInMetric(defaultWidth, units)`, `client/src/segments/drag_and_drop.ts:732`). |
| `defaultVariant` | Variant string used for palette drag preview and drop. If absent, the **first key of `details`** is used (`drag_and_drop.ts:678-679`). |
| `defaultElevation` | number (m) or `{metric, imperial}`. If absent, elevation comes from the variant's first `lanes` component (`components.yaml` lane `elevation`). |
| `enableElevation` | boolean; UNVERIFIED consumer (grep shows only data; likely gates the elevation control). |
| `defaultSlope` | array of 2 heights; if set, dropped slice gets `slope.on = true`. Only `slope` uses it. |
| `rules` | `minWidth`, `maxWidth` (`MeasurementValues`), `slope` (`'off'|'path'|'berm'`). Width rules produce **warnings only** (`tooNarrow`/`tooWide`), not hard limits. |
| `enableWithFlag` | Segment hidden from palette unless the named feature flag is true (`PaletteItems.tsx:24-28`). |
| `unlockWithFlag` | If this flag is true, `unlockCondition` is bypassed. |
| `unlockCondition` | `SIGN_IN` → locked (greyed, lock icon, tooltip "Sign in to use!") for anonymous users; `SUBSCRIBE` → locked unless `state.user.isSubscriber` ("Upgrade to Streetmix+ to use!") (`PaletteItem.tsx:37-72`). |
| `description` | `{key, image, imageCredit}` → "Learn more" panel; copy lives in i18n `descriptions.<key>` (`prompt`, `content` markdown, `imageCaption`, `imageAltText`); image from `public/images/descriptions/`. |
| `variants` | Ordered array of **variant dimension names**. The variant string is dimension values joined with `|` in this order (`client/src/segments/variant_utils.ts`). `['']` means no variants. |
| `details` | Map variantString → `{ name?, nameKey?, rules?, defaultWidth?, description?, offsetY?, dangerous?, components }`. Per-variant fields **override** segment-level ones (`Object.assign({}, segmentRules, variantRules, overrides)` in `segment-dict.js`). |

`components` recipe: `{ lanes: [{id, variants}], markings: [{id}], objects: [{id, variants, offsetX?, offsetY?}], vehicles: [...], effects: [...] }`. Each item's `variants` map selects a leaf in `components.yaml` (nested keys may be arrays, e.g. `type|direction: [biker-01, inbound]`). Leaf `graphics` objects are merged across all components; duplicate slots become arrays; an item-level `offsetX`/`offsetY` wraps every sprite id in `{id, offsetX, offsetY}`.

Graphics slots (`VariantGraphics`): `ground` (surface texture), `left`, `right`, `center`, `repeat` (tiled; may be `{id, padding}`), `scatter` (`{pool:'people'}` or `{sprites:[...], minSpacing, maxSpacing, padding, originY}`), `quirks.minWidth` (minimum **render** width in m, not a rule).

There is **no** `paletteIcon`, `paletteImage`, `experimental` or `hidden` property anywhere in `packages/parts` or `client/src/segments` (grep confirmed). Palette thumbnails are implicit: sprite `thumbnails--<segment id>` from `packages/illustrations/images/thumbnails/`, falling back to `thumbnails--missing` (`PaletteItem.tsx:75-77`). Every one of the 38 ids has a thumbnail. "Hidden/experimental" is expressed only via `enableWithFlag` (all such flags default `false`, see §1.4).

Unknown placeholders (`info.ts:55-72`): `SEGMENT_UNKNOWN = {unknown:true, id:'unknown', name:'Unknown', owner:'NONE', zIndex:1, variants:[], details:{}}`; `SEGMENT_UNKNOWN_VARIANT = {unknown:true, name:'Unknown', graphics:{center:'missing'}}` (sprite `missing.svg`).

### 1.3 Segment table (all 38 types, YAML order = default palette order)

Widths are `metric m / imperial ft`. "Gating" lists `enableWithFlag` (E:), `unlockWithFlag` (U:), `unlockCondition` (C:). Elevation "lane" = inherits from lane component (sidewalk 0.15 m / 0.5 ft; raised-sidewalk 0.75 m / 2.5 ft; asphalt, drainage, beach, earth, wall = 0).

| # | id | name | nameKey | owner | zIndex | coastmix | default w (m/ft) | min w | max w | slope rule | default elev | enableElev | default variant | dims (values) | gating | description | hidden by default |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `sidewalk` | Sidewalk | `sidewalk` | PEDESTRIAN | 30 | 20 | 1.8 / 6 | 1.8 / 6 | — | path | 0.15 / 0.5 | yes | `dense` (first) | sidewalk-density: dense, normal, sparse, empty | — | — | no |
| 2 | `sidewalk-tree` | Sidewalk tree | `sidewalk-tree` | NATURE | 22 | 21 | 1.2 / 4 | — | — | path | lane | — | `big` (first) | tree-type: big, palm-tree | — | — | no |
| 3 | `sidewalk-bike-rack` | Bike rack | `bike-rack` | BIKE | 23 | 22 | 1.5 / 5 | — | — | path | lane | — | `left|sidewalk` | orientation: left, right<br>bike-rack-elevation: sidewalk-parallel, sidewalk, road | — | — | no |
| 4 | `sidewalk-bench` | Bench | `bench` | FURNITURE | 24 | 23 | 1.2 / 4 | — | — | path | lane | — | `left` (first) | bench-orientation: left, center, right | — | — | no |
| 5 | `outdoor-dining` | Outdoor dining | `outdoor-dining` | FURNITURE | 24 | 24 | 2.4 / 8 | — | — | path | lane | — | `occupied|sidewalk` (first) | occupants: occupied, empty<br>elevation: sidewalk, road | C:SIGN_IN | — | no |
| 6 | `sidewalk-wayfinding` | Wayfinding sign | `wayfinding-sign` | FURNITURE | 21 | 25 | 1.2 / 4 | — | — | path | lane | — | `large` (first) | wayfinding-type: large, medium, small | — | wayfinding-sign (wayfinding-02.jpg) | no |
| 7 | `sidewalk-lamp` | Lamp | `sidewalk-lamp` | FURNITURE | 19 | 26 | 1.2 / 4 | — | — | path | lane | — | `both|traditional` | lamp-orientation: right, both, left<br>lamp-type: modern, traditional, pride | — | — | no |
| 8 | `utilities` | Utility pole | `utility-pole` | UTILITY | 10 | — | 1.2 / 4 | — | — | berm | lane | — | `left` (first) | orientation: left, right | C:SIGN_IN | — | no |
| 9 | `parklet` | Parklet | `parklet` | FURNITURE | 15 | — | 2.4 / 8 | 2.4 / 8 | — | path | lane | — | `left` (first) | orientation: left, right | — | parklet (parklets-01.jpg, credit: San Francisco Planning Department) | no |
| 10 | `street-vendor` | Street vendor | `street-vendor` | PEDESTRIAN | 24 | — | 1.2 / 4 | 1.2 / 4 | — | path | 0.15 / 0.5 | yes | `table|concrete` | vendor-type: handcart, table, tarp, platform<br>ground: concrete, asphalt | C:SIGN_IN | — | no |
| 11 | `divider` | Buffer | `divider` | NATURE | 20 | 2 | 0.5 / 2 | — | — | — | lane | — | `flowers` | divider-type: planting-strip, planter-box, median, striped-buffer, bush, flowers, big-tree, palm-tree, bollard, dome | — | — | no |
| 12 | `crosswalk` | Crosswalk | `crosswalk` | — | — | — | 3 / 10 | — | — | — | 0 | yes | `zebra-crossing` | crosswalk-type: zebra-crossing, zebra-crossing-bike | E:SEGMENT_CROSSWALK | — | yes |
| 13 | `temporary` | Temporary barrier | `temporary-barrier` | — | 20 | — | 0.5 / 2 | — | — | — | lane | — | `traffic-cone` | temporary-barrier-type: barricade, traffic-cone, jersey-barrier-concrete, jersey-barrier-plastic | C:SIGN_IN | — | no |
| 14 | `drainage-channel` | Drainage channel | `drainage-channel` | DRAINAGE | — | 50 | 1 / 3.25 | — | — | — | lane | — | `slanted` (first) | drainage-sides: slanted, vertical | U:SEGMENT_DRAINAGE_CHANNEL_UNLOCKED<br>C:SUBSCRIBE | — | no |
| 15 | `bioswale` | Rain garden | `rain-garden` | DRAINAGE | — | 3 | 3 / 10 | 2.45 / 8 | — | — | lane | — | `bush` (first) | bioswale-vegetation: bush, tree | E:COASTMIX_MODE<br>C:SUBSCRIBE | rain-garden (bioswale-02.jpg, credit: Lou Huang) | yes |
| 16 | `scooter` | Electric scooter | `scooter` | BIKE | 16 | — | 1.5 / 5 | 1.2 / 4 | — | path | lane | — | `inbound|regular` (first) | direction: inbound, outbound<br>bike-asphalt: regular, green, red | — | — | no |
| 17 | `scooter-drop-zone` | Scooter drop zone | `scooter-drop-zone` | FLEX | 21 | — | 1.5 / 5 | — | — | — | lane | — | `right|sidewalk|empty` | orientation: left, right<br>scooter-elevation: sidewalk, road<br>scooter-riders: empty, sparse | — | — | no |
| 18 | `bike-lane` | Bike lane | `bike-lane` | BIKE | 16 | 30 | 1.8 / 6 | 1.5 / 5 | — | path | lane | — | `inbound|regular|road` (first) | bike-direction: inbound, outbound, twoway-left, twoway-right<br>bike-asphalt: regular, green, red<br>elevation: road, sidewalk | — | bike-lane (bike-lane-02.jpg) | no |
| 19 | `bikeshare` | Bikeshare station | `bikeshare-station` | FURNITURE | 21 | 31 | 2 / 7 | 2.1 / 7 | 3 / 10 | — | lane | — | `left|road` (first) | orientation: left, right<br>elevation: road, sidewalk | — | — | no |
| 20 | `food-truck` | Food truck | `foodtruck` | CAR | 20 | 32 | 3 / 10 | 3 / 10 | — | — | lane | — | `left` (first) | orientation: left, right | — | — | no |
| 21 | `flex-zone` | Flex zone | `flex-zone` | FLEX | 15 | — | 2 / 7 | 2.1 / 7 | 3 / 10 | — | lane | — | `taxi|inbound|left` (first) | flex-type: taxi, rideshare<br>direction: inbound, outbound<br>orientation: left, right | — | — | no |
| 22 | `flex-zone-curb` | Waiting area | `flex-zone-curb` | FLEX | 30 | — | 1.2 / 4 | — | — | — | lane | — | `sparse|left` (first) | waiting-area: sparse, empty<br>orientation: left, right | — | — | no |
| 23 | `parking-lane` | Parking lane | `parking-lane` | CAR | 13 | 40 | 2 / 7 | 2.1 / 7 | 3 / 10 | path | lane | — | `inbound|left` (first) | parking-lane-direction: inbound, outbound, sideways, angled-front-left, angled-front-right, angled-rear-left, angled-rear-right<br>parking-lane-orientation: left, right | — | — | no |
| 24 | `drive-lane` | Drive lane | `drive-lane` | CAR | 14 | 41 | 3 / 10 | 2.4 / 8 | 3.6 / 12 | path | lane | — | `inbound|car` (first) | direction: inbound, outbound<br>car-type: car, car-with-bus, car-with-bike, sharrow, bus, truck, microvan, av, motorcycle-sidecar, pedestrian | — | — | no |
| 25 | `turn-lane` | Turn lane | `turn-lane` | CAR | 13 | — | 3 / 10 | 2.7 / 9 | 3.6 / 12 | path | lane | — | `inbound|left` (first) | direction: inbound, outbound<br>turn-lane-orientation: left, left-straight, straight, right-straight, right, both, left-right-straight, shared | — | — | no |
| 26 | `bus-lane` | Bus lane | `bus-lane` | TRANSIT | 15 | 42 | 3.6 / 12 | 3 / 10 | 3.9 / 13 | path | lane | — | `inbound|regular|typical` (first) | direction: inbound, outbound<br>bus-asphalt: regular, colored, shared<br>bus-type: typical, double-decker, av-shuttle | — | — | no |
| 27 | `streetcar` | Streetcar | `streetcar` | TRANSIT | 15 | 43 | 3.6 / 12 | 3 / 10 | 4.2 / 14 | path | lane | — | `inbound|regular` (first) | direction: inbound, outbound<br>public-transit-asphalt: regular, colored, grass | — | — | no |
| 28 | `light-rail` | Light rail | `light-rail` | TRANSIT | 15 | 44 | 3.6 / 12 | 3 / 10 | 4.2 / 14 | — | lane | — | `inbound|regular` (first) | direction: inbound, outbound<br>public-transit-asphalt: regular, colored, grass | — | — | no |
| 29 | `transit-shelter` | Transit shelter | `transit-shelter` | TRANSIT | 20 | 45 | 2.7 / 9 | 2.7 / 9 | — | — | lane | — | `right|street-level` | orientation: left, right<br>transit-shelter-elevation: street-level, light-rail | — | — | no |
| 30 | `brt-station` | BRT station | `brt-station` | TRANSIT | 20 | 46 | 4 / 13.5 | 4 / 13.5 | — | off | lane | — | `center` | brt-station-orientation: left, right, center | C:SIGN_IN | — | no |
| 31 | `brt-lane` | Bus rapid transit lane | `brt-lane` | TRANSIT | 15 | 47 | 3.5 / 11.667 | 3.4 / 11.5 | 4 / 13 | — | lane | — | `inbound|regular` (first) | direction: inbound, outbound<br>brt-asphalt: regular, red | C:SIGN_IN | — | no |
| 32 | `train` | “Inception” train | `inception-train` | TRANSIT | 10 | — | 4.2 / 14 | 4.2 / 14 | — | — | lane | — | `` (first) | : '' | E:SEGMENT_INCEPTION_TRAIN | inception-train (train.jpg) | yes |
| 33 | `magic-carpet` | Magic carpet | `magic-carpet` | — | — | — | 3 / 10 | — | — | berm | lane | — | `jasmine-aladdin` | magic-carpet-occupants: aladdin, jasmine, aladdin-jasmine, jasmine-aladdin | C:SIGN_IN | — | no |
| 34 | `beach` | Beach | `beach` | NATURE | — | 4 | 1.2 / 4 | — | — | berm | lane | — | `lounger` | beach-type: beach, lounger | E:COASTMIX_MODE | — | yes |
| 35 | `marsh` | Marsh | `marsh` | NATURE | — | 5 | 1.2 / 4 | — | — | berm | lane | — | `marsh` | marsh-type: marsh | E:COASTMIX_MODE | marsh (marsh-01.jpg) | yes |
| 36 | `wall` | Wall | `wall` | WALL | 35 | 10 | 0.75 / 2.5 | — | — | — | lane | — | `low` | wall-height: low, high | E:COASTMIX_MODE | — | yes |
| 37 | `guardrail` | Guard rail | `guardrail` | — | — | 11 | 0.25 / 1 | — | — | — | lane | — | `default` (first) | guardrail-type: default | E:COASTMIX_MODE | — | yes |
| 38 | `slope` | Slope | `slope` | — | — | 1 | 2.4 / 8 | — | — | berm | lane | — | `grass` (first) | slope-type: grass, dune | E:COASTMIX_MODE | — | yes |


### 1.4 Feature flags and roles that affect the catalog

From `packages/feature-flags/flags.json` (all `defaultValue:false` unless noted) and `app/data/user_roles.json`:

| Flag | Label | Default | Effect on catalog |
|---|---|---|---|
| `SEGMENT_CROSSWALK` | Component — crosswalk | false | shows `crosswalk` |
| `SEGMENT_INCEPTION_TRAIN` | Component — the train from "Inception" | false | shows `train` |
| `SEGMENT_DRAINAGE_CHANNEL_UNLOCKED` | Component — drainage channel (unlocked) | false | bypasses SUBSCRIBE lock on `drainage-channel` |
| `COASTMIX_MODE` | Coastmix features | false | shows `bioswale`, `beach`, `marsh`, `wall`, `guardrail`, `slope`; switches palette to `coastmixPaletteOrder` ordering; enables waterfront2/beach/marsh/water/dock/fishing-boat/cargo-ship boundaries, hides `waterfront`; unlocks skybox picker; hides `elevation` variant buttons; New Street menu shows "New empty waterfront" |
| `VARIANT_MIXED_DRIVE_LANES_1` / `_2` | mixed-traffic drive lane (bus / bike) unlocked | false | bypass SUBSCRIBE lock on `car-type: car-with-bus` / `car-with-bike` |
| `ELEVATION_CONTROLS_UNLOCKED` | elevation property controls (unlocked) | false | bypass SUBSCRIBE lock on `universal-elevation` buttons |
| `UNIVERSAL_ELEVATION_CONTROLS` | universal elevation controls | false | hides per-variant `elevation` buttons |
| `ENVIRONMENTS_UNLOCKED` | Environment — unlocked | false | unlocks skybox/weather picker for non-subscribers |
| `WEATHER_EFFECTS` | Environment — weather effects | false | shows Weather (Clear/Rain/Snow) section |
| `SKY_ANIMATED_CLOUDS` | Sky — animated clouds | false | adds `sky-animations` class (CSS keyframe cloud drift) |
| `NEW_STREET_TEMPLATES` | Additional street templates | **true** | shows "Street templates > Stroad" |
| `SEGMENT_3D_PARKING` | 3d angled parking | false, `enabled:false` | unused in data |
| `ANALYTICS` | Street analytics | true | capacity panel |

Roles (`app/data/user_roles.json`): `USER` → `VARIANT_TWOWAY_BIKES:true` (flag no longer exists in flags.json; two-way bike lanes are gated by `unlockCondition: SIGN_IN` in `variant_icons.yaml` instead); `ADMIN` → `COASTMIX_MODE`, `NEW_STREET_TEMPLATES`, `COLOR_MODE_TOGGLE`, `LOCALES_LEVEL_1`; `BETA_TESTER` → all component/variant unlock flags + `COASTMIX_MODE`; `ITDP` → `ELEVATION_CONTROLS_UNLOCKED`, `SEGMENT_DRAINAGE_CHANNEL_UNLOCKED`, `VARIANT_MIXED_DRIVE_LANES_1/2`; `SUBSCRIBER_1` → `SAVE_AS_IMAGE_CUSTOM_DPI`; `SUBSCRIBER_2/3` → none. Subscriber status itself (`state.user.isSubscriber`) is what unlocks `SUBSCRIBE` items.

### 1.5 Variant dimensions, values and per-value gating (`client/src/segments/variant_icons.yaml`)

Variant buttons in the info bubble are driven by `variant_icons.yaml` (`VariantButton.tsx`). A value is **omitted** when `enableWithFlag` is false or `disableWithFlag` is true; it is **locked** per `unlockCondition` unless `unlockWithFlag` is true. Icon ids refer to `packages/variant-icons/icons/*.svg` (`icon-` sprite) unless `iconSet: tabler`.

| dimension | used by segments | values → icon (title) [gating] |
|---|---|---|
| `boundary` | boundaries (§2) | `waterfront` → waterfront (Waterfront) **[D:COASTMIX_MODE]**<br>`waterfront2` → waterfront (Waterfront) **[E:COASTMIX_MODE]**<br>`beach` → beach [tabler] (Beach) **[E:COASTMIX_MODE]**<br>`marsh` → marsh (Marsh) **[E:COASTMIX_MODE]**<br>`water` → water (Water) **[E:COASTMIX_MODE]**<br>`dock` → dock (Dock) **[E:COASTMIX_MODE]**<br>`fishing-boat` → fishing-boat (Fishing boat) **[E:COASTMIX_MODE]**<br>`cargo-ship` → cargo-ship (Cargo ship) **[E:COASTMIX_MODE]**<br>`grass` → grass (Grass)<br>`fence` → fence (Empty lot)<br>`parking-lot` → car (Parking lot)<br>`residential` → residential (Home)<br>`narrow` → building-thin (Narrow building)<br>`wide` → building-wide (Wide building)<br>`arcade` → building-arcade (Arcade building)<br>`compound-wall` → compound-wall (Compound wall) **[C:SIGN_IN]** |
| `ground` | (unused by segment-lookup) | `concrete` → concrete #ff0000 (Concrete)<br>`asphalt` → asphalt #292a29 (Asphalt) |
| `direction` | scooter, flex-zone, drive-lane, turn-lane, bus-lane, streetcar, light-rail, brt-lane | `inbound` → direction-inbound (Inbound)<br>`outbound` → direction-outbound (Outbound) |
| `bike-direction` | bike-lane | `inbound` → direction-inbound (Inbound)<br>`outbound` → direction-outbound (Outbound)<br>`twoway-left` → direction-twoway-left (Two-way (left-hand)) **[C:SIGN_IN]**<br>`twoway-right` → direction-twoway-right (Two-way (right-hand)) **[C:SIGN_IN]** |
| `parking-lane-direction` | parking-lane | `inbound` → direction-inbound (Inbound)<br>`outbound` → direction-outbound (Outbound)<br>`sideways` → direction-both (Perpendicular)<br>`angled-front-left` → direction-down-left (Angled)<br>`angled-front-right` → direction-down-right (Angled)<br>`angled-rear-left` → direction-up-left (Angled)<br>`angled-rear-right` → direction-up-right (Angled) |
| `tree-type` | sidewalk-tree | `big` → tree (Tree)<br>`palm-tree` → palm-tree (Palm tree) |
| `lamp-orientation` | sidewalk-lamp | `left` → direction-left (Left)<br>`both` → direction-both (Both)<br>`right` → direction-right (Right) |
| `lamp-type` | sidewalk-lamp | `modern` → lamp-modern (Modern)<br>`traditional` → lamp-traditional-right (Traditional)<br>`pride` → rainbow (Modern with pride banner) |
| `bench-orientation` | sidewalk-bench | `left` → direction-left (Left)<br>`center` → direction-both (Center)<br>`right` → direction-right (Right) |
| `turn-lane-orientation` | turn-lane | `left` → turn-lane-left (Left)<br>`left-straight` → turn-lane-left-straight (Left and straight)<br>`straight` → turn-lane-straight (Straight)<br>`right-straight` → turn-lane-right-straight (Right and straight)<br>`right` → turn-lane-right (Right)<br>`both` → turn-lane-both (Both)<br>`left-right-straight` → turn-lane-left-right-straight (Left, right and straight)<br>`shared` → turn-lane-shared (Shared) |
| `divider-type` | divider | `median` → median (Median)<br>`striped-buffer` → buffer (Striped buffer)<br>`planting-strip` → grass (Planting strip)<br>`planter-box` → planter-box (Planter box)<br>`bush` → bush (Planting strip with a bush)<br>`flowers` → flowers (Planting strip with flowers)<br>`big-tree` → tree (Planting strip with a tree)<br>`palm-tree` → palm-tree (Planting strip with a palm tree)<br>`bollard` → bollard (Bollard)<br>`dome` → dome (Traffic exclusion dome) |
| `crosswalk-type` | crosswalk | `zebra-crossing` → buffer (Crosswalk)<br>`zebra-crossing-bike` → buffer (Bike crossing) |
| `orientation` | sidewalk-bike-rack, utilities, parklet, scooter-drop-zone, bikeshare, food-truck, flex-zone, flex-zone-curb, transit-shelter | `left` → orientation-left (Left)<br>`right` → orientation-right (Right) |
| `public-transit-asphalt` | streetcar, light-rail | `regular` → asphalt #292a29 (Asphalt)<br>`colored` → asphalt #9b1f22 (Red lane)<br>`grass` → grass (Grass) |
| `bus-asphalt` | bus-lane | `regular` → asphalt #292a29 (Asphalt)<br>`colored` → asphalt #9b1f22 (Red lane)<br>`shared` → sharrow (Shared bus/bike lane) |
| `bus-type` | bus-lane | `typical` → bus (Typical bus)<br>`double-decker` → double-decker-bus (Double decker bus) **[C:SUBSCRIBE]**<br>`av-shuttle` → av-shuttle (Autonomous shuttle) **[C:SUBSCRIBE]** |
| `brt-asphalt` | brt-lane | `regular` → asphalt #292a29 (Asphalt)<br>`red` → asphalt #9b1f22 (Red lane) |
| `brt-station-orientation` | brt-station | `left` → orientation-left (Left)<br>`right` → orientation-right (Right)<br>`center` → orientation-center (Center) |
| `bike-asphalt` | scooter, bike-lane | `regular` → asphalt #292a29 (Asphalt)<br>`green` → asphalt #2b6750 (Green lane)<br>`red` → asphalt #9b1f22 (Red lane) |
| `transit-shelter-elevation` | transit-shelter | `street-level` → elevation-lower (Street level)<br>`light-rail` → elevation-higher (Light rail platform) |
| `bike-rack-elevation` | sidewalk-bike-rack | `sidewalk-parallel` → direction-both (Parallel parking, sidewalk level)<br>`sidewalk` → elevation-higher (Perpendicular parking, sidewalk level)<br>`road` → elevation-lower (Perpendicular parking, road level) |
| `car-type` | drive-lane | `car` → car (Car)<br>`car-with-bus` → car-with-bus (Car with bus) **[C:SUBSCRIBE, U:VARIANT_MIXED_DRIVE_LANES_1]**<br>`car-with-bike` → car-with-bike (Car with bike) **[C:SUBSCRIBE, U:VARIANT_MIXED_DRIVE_LANES_2]**<br>`sharrow` → sharrow (Sharrow)<br>`truck` → truck (Truck)<br>`microvan` → microvan (Microvan) **[C:SUBSCRIBE]**<br>`av` → rideshare (Autonomous vehicle) **[C:SIGN_IN]**<br>`motorcycle-sidecar` → motorcycle-sidecar (Motorcycle with sidecar) **[C:SIGN_IN]**<br>`pedestrian` → sidewalk-density-normal (Pedestrian) **[C:SIGN_IN]** |
| `sidewalk-density` | sidewalk | `dense` → sidewalk-density-dense (Dense)<br>`normal` → sidewalk-density-normal (Normal)<br>`sparse` → sidewalk-density-sparse (Sparse)<br>`empty` → (no icon) (Empty) |
| `parking-lane-orientation` | parking-lane | `left` → orientation-left (Left)<br>`right` → orientation-right (Right) |
| `wayfinding-type` | sidewalk-wayfinding | `large` → wayfinding-large (Large)<br>`medium` → wayfinding-medium (Medium)<br>`small` → wayfinding-small (Small) |
| `flex-type` | flex-zone | `taxi` → taxi (Taxi)<br>`rideshare` → rideshare (Rideshare) |
| `waiting-area` | flex-zone-curb | `sparse` → sidewalk-density-sparse (Someone)<br>`empty` → (no icon) (No one) |
| `scooter-elevation` | scooter-drop-zone | `sidewalk` → elevation-higher (Sidewalk level)<br>`road` → elevation-lower (Road level) |
| `scooter-riders` | scooter-drop-zone | `empty` → (no icon) (No one)<br>`sparse` → sidewalk-density-sparse (Someone) |
| `magic-carpet-occupants` | magic-carpet | `aladdin` → aladdin (Aladdin)<br>`jasmine` → jasmine (Jasmine)<br>`aladdin-jasmine` → aladdin-jasmine (Aladdin & Jasmine)<br>`jasmine-aladdin` → jasmine-aladdin (Jasmine & Aladdin) |
| `occupants` | outdoor-dining | `empty` → (no icon) (Empty)<br>`occupied` → sidewalk-density-normal (Occupied) |
| `elevation` | outdoor-dining, bike-lane, bikeshare | `sidewalk` → elevation-higher (Sidewalk level)<br>`road` → elevation-lower (Street level) |
| `universal-elevation` | all slices when UNIVERSAL_ELEVATION_CONTROLS | `sidewalk` → elevation-higher (Sidewalk level) **[C:SUBSCRIBE, U:ELEVATION_CONTROLS_UNLOCKED]**<br>`road` → elevation-lower (Street level) **[C:SUBSCRIBE, U:ELEVATION_CONTROLS_UNLOCKED]** |
| `temporary-barrier-type` | temporary | `traffic-cone` → traffic-cone (Traffic cone)<br>`barricade` → barricade (Barricade)<br>`jersey-barrier-concrete` → jersey-barrier (Jersey barrier (concrete))<br>`jersey-barrier-plastic` → jersey-barrier #ef9c74 (Jersey barrier (plastic)) |
| `drainage-sides` | drainage-channel | `slanted` → drainage-slanted (Slanted sides)<br>`vertical` → drainage-vertical (Vertical sides) |
| `bioswale-vegetation` | bioswale | `bush` → bush (Rain garden with bushes)<br>`tree` → tree (Rain garden with trees) |
| `brt-bus` | (none) | (empty) |
| `vendor-type` | street-vendor | `handcart` → vendor-handcart (Vendor with hand cart)<br>`table` → vendor-table (Vendor at table)<br>`tarp` → vendor-tarp (Vendor on tarp on ground)<br>`platform` → vendor-platform (Vendor at platform) |
| `beach-type` | beach | `beach` → beach-off [tabler] (Beach)<br>`lounger` → beach [tabler] (Beach lounger) |
| `marsh-type` | marsh | `marsh` → marsh (Marsh) |
| `wall-height` | wall | `low` → elevation-lower (Low wall)<br>`high` → elevation-higher (High wall) |
| `guardrail-type` | guardrail | `default` → bollard (Guard rail) |
| `slope-type` | slope | `grass` → grass (Grassy hill)<br>`dune` → marsh (Sand dune) |


### 1.6 Per-variant detail (components, overrides, resolved graphics)

For each segment: variant string → `elev` (from lane), overrides merged over segment rules, components recipe, and the resolved graphics object exactly as `getSegmentVariantInfo().graphics` would return it. Sprite ids are `<dir>--<file>` in `packages/illustrations/images/`. All referenced sprites exist in the illustrations package (checked programmatically).


#### `sidewalk` — Sidewalk (4 variants)

- `dense` (Sidewalk) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); vehicles: pedestrian(density=dense)<br>  graphics: `{"ground":"ground--concrete","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.5,"padding":0.5}}`
- `normal` (Sidewalk) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); vehicles: pedestrian(density=normal)<br>  graphics: `{"ground":"ground--concrete","scatter":{"pool":"people","minSpacing":0,"maxSpacing":1.5,"padding":0.5}}`
- `sparse` (Sidewalk) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); vehicles: pedestrian(density=sparse)<br>  graphics: `{"ground":"ground--concrete","scatter":{"pool":"people","minSpacing":1,"maxSpacing":3.5,"padding":0.5}}`
- `empty` (Sidewalk) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular)<br>  graphics: `{"ground":"ground--concrete"}`

#### `sidewalk-tree` — Sidewalk tree (2 variants)

- `big` (Sidewalk tree) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: tree(type=big)<br>  graphics: `{"ground":"ground--concrete","center":"trees--tree"}`
- `palm-tree` (Sidewalk tree) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: tree(type=palm-tree)<br>  graphics: `{"ground":"ground--concrete","center":"trees--palm-tree"}`

#### `sidewalk-bike-rack` — Bike rack (6 variants)

- `left|sidewalk-parallel` (Bike rack) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bike-rack(direction\|orientation=parallel/left)<br>  graphics: `{"ground":"ground--concrete","left":"bikes--bike-rack-parallel-left"}`
- `right|sidewalk-parallel` (Bike rack) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bike-rack(direction\|orientation=parallel/right)<br>  graphics: `{"ground":"ground--concrete","right":"bikes--bike-rack-parallel-right"}`
- `left|sidewalk` (Bike rack) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bike-rack(direction\|orientation=perpendicular/left)<br>  graphics: `{"ground":"ground--concrete","left":"bikes--bike-rack-perpendicular-left"}`
- `right|sidewalk` (Bike rack) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bike-rack(direction\|orientation=perpendicular/right)<br>  graphics: `{"ground":"ground--concrete","right":"bikes--bike-rack-perpendicular-right"}`
- `left|road` (Bike rack) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: bike-rack(direction\|orientation=perpendicular/left)<br>  graphics: `{"ground":"ground--asphalt","left":"bikes--bike-rack-perpendicular-left"}`
- `right|road` (Bike rack) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: bike-rack(direction\|orientation=perpendicular/right)<br>  graphics: `{"ground":"ground--asphalt","right":"bikes--bike-rack-perpendicular-right"}`

#### `sidewalk-bench` — Bench (3 variants)

- `left` (Bench) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bench(orientation=left)<br>  graphics: `{"ground":"ground--concrete","left":"furniture--bench-left"}`
- `center` (Bench) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bench(orientation=center)<br>  graphics: `{"ground":"ground--concrete","center":"furniture--bench-center"}`
- `right` (Bench) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bench(orientation=right)<br>  graphics: `{"ground":"ground--concrete","right":"furniture--bench-right"}`

#### `outdoor-dining` — Outdoor dining (4 variants)

- `occupied|sidewalk` (Outdoor dining) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: outdoor-dining(occupants=occupied)<br>  graphics: `{"ground":"ground--concrete","center":"furniture--cafe-seating-occupied"}`
- `empty|sidewalk` (Outdoor dining) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: outdoor-dining(occupants=empty)<br>  graphics: `{"ground":"ground--concrete","center":"furniture--cafe-seating"}`
- `occupied|road` (Outdoor dining) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left markings--lane-right; objects: outdoor-dining(occupants=occupied)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","right":"markings--lane-right","center":"furniture--cafe-seating-occupied"}`
- `empty|road` (Outdoor dining) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left markings--lane-right; objects: outdoor-dining(occupants=empty)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","right":"markings--lane-right","center":"furniture--cafe-seating"}`

#### `sidewalk-wayfinding` — Wayfinding sign (3 variants)

- `large` (Wayfinding sign) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: wayfinding-sign(type=large)<br>  graphics: `{"ground":"ground--concrete","center":"wayfinding--nyc-wayfinding-pylon-large"}`
- `medium` (Wayfinding sign) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: wayfinding-sign(type=medium)<br>  graphics: `{"ground":"ground--concrete","center":"wayfinding--nyc-wayfinding-pylon-medium"}`
- `small` (Wayfinding sign) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: wayfinding-sign(type=small)<br>  graphics: `{"ground":"ground--concrete","center":"wayfinding--nyc-wayfinding-pylon-small"}`

#### `sidewalk-lamp` — Lamp (9 variants)

- `right|modern` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=modern/right)<br>  graphics: `{"ground":"ground--concrete","right":"lamps--lamp-modern-right"}`
- `both|modern` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=modern/both)<br>  graphics: `{"ground":"ground--concrete","center":"lamps--lamp-modern-both"}`
- `left|modern` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=modern/left)<br>  graphics: `{"ground":"ground--concrete","left":"lamps--lamp-modern-left"}`
- `right|traditional` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=traditional/right)<br>  graphics: `{"ground":"ground--concrete","right":"lamps--lamp-traditional-right"}`
- `both|traditional` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=traditional/both)<br>  graphics: `{"ground":"ground--concrete","center":"lamps--lamp-traditional-center"}`
- `left|traditional` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=traditional/left)<br>  graphics: `{"ground":"ground--concrete","left":"lamps--lamp-traditional-left"}`
- `right|pride` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=modern/right) pride-banner(orientation=right)<br>  graphics: `{"ground":"ground--concrete","right":["lamps--lamp-modern-right","lamps--pride-banner-right"]}`
- `left|pride` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=modern/left) pride-banner(orientation=left)<br>  graphics: `{"ground":"ground--concrete","left":["lamps--lamp-modern-left","lamps--pride-banner-left"]}`
- `both|pride` (Lamp) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: lamp(type\|orientation=modern/both) pride-banner(orientation=both)<br>  graphics: `{"ground":"ground--concrete","center":["lamps--lamp-modern-both",{"id":"lamps--pride-banner-left","offsetX":49}]}`

#### `utilities` — Utility pole (2 variants)

- `left` (Utility pole) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: utility-pole(orientation=left)<br>  graphics: `{"ground":"ground--concrete","center":"utilities--utility-pole-left"}`
- `right` (Utility pole) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: utility-pole(orientation=right)<br>  graphics: `{"ground":"ground--concrete","center":"utilities--utility-pole-right"}`

#### `parklet` — Parklet (2 variants)

- `left` (Parklet) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: parklet(orientation=left)<br>  graphics: `{"ground":"ground--asphalt","left":"parklet--yerba-buena-parklet-left-v02"}`
- `right` (Parklet) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: parklet(orientation=right)<br>  graphics: `{"ground":"ground--asphalt","right":"parklet--yerba-buena-parklet-right-v02"}`

#### `street-vendor` — Street vendor (8 variants)

- `handcart|concrete` (Street vendor) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":0.9,"imperial":3}}`<br>  components: lanes: sidewalk(color=regular); objects: street-vendor(vendor-type=handcart)<br>  graphics: `{"ground":"ground--concrete","center":"vendors--vendor-handcart"}`
- `table|concrete` (Street vendor) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: street-vendor(vendor-type=table)<br>  graphics: `{"ground":"ground--concrete","center":"vendors--vendor-table"}`
- `tarp|concrete` (Street vendor) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: street-vendor(vendor-type=tarp)<br>  graphics: `{"ground":"ground--concrete","center":"vendors--vendor-tarp"}`
- `platform|concrete` (Street vendor) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: street-vendor(vendor-type=platform)<br>  graphics: `{"ground":"ground--concrete","center":"vendors--vendor-platform"}`
- `handcart|asphalt` (Street vendor) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":0.9,"imperial":3}}`<br>  components: lanes: asphalt(color=regular); objects: street-vendor(vendor-type=handcart)<br>  graphics: `{"ground":"ground--asphalt","center":"vendors--vendor-handcart"}`
- `table|asphalt` (Street vendor) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: street-vendor(vendor-type=table)<br>  graphics: `{"ground":"ground--asphalt","center":"vendors--vendor-table"}`
- `tarp|asphalt` (Street vendor) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: street-vendor(vendor-type=tarp)<br>  graphics: `{"ground":"ground--asphalt","center":"vendors--vendor-tarp"}`
- `platform|asphalt` (Street vendor) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); objects: street-vendor(vendor-type=platform)<br>  graphics: `{"ground":"ground--asphalt","center":"vendors--vendor-platform"}`

#### `divider` — Buffer (10 variants)

- `planting-strip` (Planting strip) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Planting strip","nameKey":"planting-strip"}`<br>  components: lanes: sidewalk(color=regular); objects: planting-strip(type=grass)<br>  graphics: `{"ground":"ground--concrete","repeat":"plants--grass"}`
- `planter-box` (Planter box) elev=0 [asphalt] **overrides** `{"name":"Planter box","nameKey":"planter-box"}`<br>  components: lanes: asphalt(color=regular); markings: markings--stripes-diagonal markings--lane-left markings--lane-right; objects: planter-box(type=default)<br>  graphics: `{"ground":"ground--asphalt","repeat":"markings--stripes-diagonal","left":"markings--lane-left","right":"markings--lane-right","center":"dividers--planter-box"}`
- `median` (Median) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Median","nameKey":"median"}`<br>  components: lanes: sidewalk(color=regular)<br>  graphics: `{"ground":"ground--concrete"}`
- `striped-buffer` (Buffer) elev=0 [asphalt] **overrides** `{"name":"Buffer","nameKey":"divider"}`<br>  components: lanes: asphalt(color=regular); markings: markings--stripes-diagonal markings--lane-left markings--lane-right<br>  graphics: `{"ground":"ground--asphalt","repeat":"markings--stripes-diagonal","left":"markings--lane-left","right":"markings--lane-right"}`
- `bush` (Planting strip) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Planting strip","nameKey":"planting-strip"}`<br>  components: lanes: sidewalk(color=regular); objects: planting-strip(type=grass) planting-strip(type=bush)<br>  graphics: `{"ground":"ground--concrete","repeat":"plants--grass","scatter":{"sprites":["plants--bush"],"minSpacing":-1,"maxSpacing":1,"padding":0.5}}`
- `flowers` (Planting strip) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Planting strip","nameKey":"planting-strip"}`<br>  components: lanes: sidewalk(color=regular); objects: planting-strip(type=grass) planting-strip(type=flowers)<br>  graphics: `{"ground":"ground--concrete","repeat":"plants--grass","scatter":{"sprites":["plants--flowers-red",{"id":"plants--flowers-orange","width":1,"disallowFirst":true,"weight":20},{"id":"plants--flowers-yellow","width":1,"disallowFirst":true},{"id":"plants--flowers-white","width":1,"disallowFirst":true,"weight":20},{"id":"plants--flowers-blue","width":1,"disallowFirst":true,"weight":10}],"minSpacing":-0.5,"maxSpacing":1,"padding":0.5}}`
- `big-tree` (Planting strip) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Planting strip","nameKey":"planting-strip"}`<br>  components: lanes: sidewalk(color=regular); objects: planting-strip(type=grass) tree(type=big)<br>  graphics: `{"ground":"ground--concrete","repeat":"plants--grass","center":"trees--tree"}`
- `palm-tree` (Planting strip) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Planting strip","nameKey":"planting-strip"}`<br>  components: lanes: sidewalk(color=regular); objects: planting-strip(type=grass) tree(type=palm-tree)<br>  graphics: `{"ground":"ground--concrete","repeat":"plants--grass","center":"trees--palm-tree"}`
- `bollard` (Bollard) elev=0 [asphalt] **overrides** `{"name":"Bollard","nameKey":"bollard"}`<br>  components: lanes: asphalt(color=regular); markings: markings--stripes-diagonal markings--lane-left markings--lane-right; objects: bollard(type=default)<br>  graphics: `{"ground":"ground--asphalt","repeat":"markings--stripes-diagonal","left":"markings--lane-left","right":"markings--lane-right","center":"dividers--bollard"}`
- `dome` (Traffic exclusion dome) elev=0 [asphalt] **overrides** `{"name":"Traffic exclusion dome","nameKey":"dome"}`<br>  components: lanes: asphalt(color=regular); markings: markings--stripes-diagonal markings--lane-left markings--lane-right; objects: dome(type=default)<br>  graphics: `{"ground":"ground--asphalt","repeat":"markings--stripes-diagonal","left":"markings--lane-left","right":"markings--lane-right","center":"dividers--dome"}`

#### `crosswalk` — Crosswalk (2 variants)

- `zebra-crossing` (Crosswalk) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--crosswalk-zebra<br>  graphics: `{"ground":"ground--asphalt","repeat":"markings--crosswalk-zebra"}`
- `zebra-crossing-bike` (Crosswalk) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--crosswalk-zebra-bike<br>  graphics: `{"ground":"ground--asphalt","repeat":"markings--crosswalk-zebra-bike"}`

#### `temporary` — Temporary barrier (4 variants)

- `barricade` (Barricade) elev=0 [asphalt] **overrides** `{"name":"Barricade","nameKey":"barricade"}`<br>  components: lanes: asphalt(color=regular); objects: barricade(type=default)<br>  graphics: `{"ground":"ground--asphalt","center":"construction--barricade"}`
- `traffic-cone` (Traffic cone) elev=0 [asphalt] **overrides** `{"name":"Traffic cone","nameKey":"traffic-cone"}`<br>  components: lanes: asphalt(color=regular); objects: traffic-cone(type=default)<br>  graphics: `{"ground":"ground--asphalt","center":"construction--cone"}`
- `jersey-barrier-concrete` (Jersey barrier) elev=0 [asphalt] **overrides** `{"name":"Jersey barrier","nameKey":"jersey-barrier"}`<br>  components: lanes: asphalt(color=regular); objects: jersey-barrier(material=concrete)<br>  graphics: `{"ground":"ground--asphalt","center":"construction--jersey-barrier-concrete"}`
- `jersey-barrier-plastic` (Jersey barrier) elev=0 [asphalt] **overrides** `{"name":"Jersey barrier","nameKey":"jersey-barrier"}`<br>  components: lanes: asphalt(color=regular); objects: jersey-barrier(material=plastic)<br>  graphics: `{"ground":"ground--asphalt","center":"construction--jersey-barrier-plastic"}`

#### `drainage-channel` — Drainage channel (2 variants)

- `slanted` (Drainage channel) elev=0 [drainage] **overrides** `{"offsetY":-50}`<br>  components: lanes: drainage(color=regular); objects: open-drain(drainage-sides=slanted)<br>  graphics: `{"ground":"ground--concrete","quirks":{"minWidth":0.9},"repeat":"utilities--drainage-channel-piece-center","left":"utilities--drainage-channel-piece-left-slanted","right":"utilities--drainage-channel-piece-right-slanted"}`
- `vertical` (Drainage channel) elev=0 [drainage] **overrides** `{"offsetY":-50}`<br>  components: lanes: drainage(color=regular); objects: open-drain(drainage-sides=vertical)<br>  graphics: `{"ground":"ground--concrete","quirks":{"minWidth":0.5},"repeat":"utilities--drainage-channel-piece-center","left":"utilities--drainage-channel-piece-left-vertical","right":"utilities--drainage-channel-piece-right-vertical"}`

#### `bioswale` — Rain garden (2 variants)

- `bush` (Rain garden) elev=0 [earth] **overrides** `{"offsetY":-50}`<br>  components: lanes: earth(type=default); objects: planting-strip(type=grass) bioswale(plants=bush,sides=slanted)<br>  graphics: `{"repeat":["earth--surface","plants--grass"],"ground":"ground--earth","scatter":{"sprites":["plants--bush"],"minSpacing":-1,"maxSpacing":1,"padding":1},"quirks":{"minWidth":2.5},"left":"plants--bioswale-pieces-slope-left","right":"plants--bioswale-pieces-slope-right"}`
- `tree` (Rain garden) elev=0 [earth] **overrides** `{"offsetY":-50}`<br>  components: lanes: earth(type=default); objects: planting-strip(type=grass) bioswale(plants=tree,sides=slanted)<br>  graphics: `{"repeat":["earth--surface","plants--grass"],"ground":"ground--earth","scatter":{"sprites":["trees--tree"],"minSpacing":-1,"maxSpacing":1,"padding":1},"quirks":{"minWidth":2.5},"left":"plants--bioswale-pieces-slope-left","right":"plants--bioswale-pieces-slope-right"}`

#### `scooter` — Electric scooter (6 variants)

- `inbound|regular` (Electric scooter) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: scooter(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","scooters--scooter-inbound"]}`
- `outbound|regular` (Electric scooter) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: scooter(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","scooters--scooter-outbound"]}`
- `inbound|green` (Electric scooter) elev=0 [asphalt]<br>  components: lanes: asphalt(color=green); markings: markings--straight-inbound-light; vehicles: scooter(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--straight-inbound-light","scooters--scooter-inbound"]}`
- `outbound|green` (Electric scooter) elev=0 [asphalt]<br>  components: lanes: asphalt(color=green); markings: markings--straight-outbound-light; vehicles: scooter(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--straight-outbound-light","scooters--scooter-outbound"]}`
- `inbound|red` (Electric scooter) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-inbound-light; vehicles: scooter(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","scooters--scooter-inbound"]}`
- `outbound|red` (Electric scooter) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-outbound-light; vehicles: scooter(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","scooters--scooter-outbound"]}`

#### `scooter-drop-zone` — Scooter drop zone (8 variants)

- `left|sidewalk|empty` (Scooter drop zone) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=empty/left)<br>  graphics: `{"ground":"ground--concrete","left":["markings--lane-left-half","scooters--scooter-left-docked"],"right":"markings--lane-right-half","repeat":"markings--lane-horiz"}`
- `right|sidewalk|empty` (Scooter drop zone) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=empty/right)<br>  graphics: `{"ground":"ground--concrete","left":"markings--lane-left-half","right":["markings--lane-right-half","scooters--scooter-right-docked"],"repeat":"markings--lane-horiz"}`
- `left|sidewalk|sparse` (Scooter drop zone) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=sparse/left)<br>  graphics: `{"ground":"ground--concrete","left":["markings--lane-left-half","scooters--scooter-left-rider"],"right":"markings--lane-right-half","repeat":"markings--lane-horiz"}`
- `right|sidewalk|sparse` (Scooter drop zone) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=sparse/right)<br>  graphics: `{"ground":"ground--concrete","left":"markings--lane-left-half","right":["markings--lane-right-half","scooters--scooter-right-rider"],"repeat":"markings--lane-horiz"}`
- `left|road|empty` (Scooter drop zone) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=empty/left)<br>  graphics: `{"ground":"ground--asphalt","left":["markings--lane-left-half","scooters--scooter-left-docked"],"right":"markings--lane-right-half","repeat":"markings--lane-horiz"}`
- `right|road|empty` (Scooter drop zone) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=empty/right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left-half","right":["markings--lane-right-half","scooters--scooter-right-docked"],"repeat":"markings--lane-horiz"}`
- `left|road|sparse` (Scooter drop zone) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=sparse/left)<br>  graphics: `{"ground":"ground--asphalt","left":["markings--lane-left-half","scooters--scooter-left-rider"],"right":"markings--lane-right-half","repeat":"markings--lane-horiz"}`
- `right|road|sparse` (Scooter drop zone) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left-half markings--lane-right-half markings--lane-horiz; vehicles: scooter(riders\|orientation=sparse/right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left-half","right":["markings--lane-right-half","scooters--scooter-right-rider"],"repeat":"markings--lane-horiz"}`

#### `bike-lane` — Bike lane (24 variants)

- `inbound|regular|road` (Bike lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: bike(type\|direction=biker-01/inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","bikes--biker-01-inbound"]}`
- `outbound|regular|road` (Bike lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: bike(type\|direction=biker-01/outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","bikes--biker-01-outbound"]}`
- `twoway-left|regular|road` (Two-way bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane"}`<br>  components: lanes: asphalt(color=regular); markings: markings--twoway-left; vehicles: bike(type\|direction=biker-02/inbound)@-50%,0 bike(type\|direction=biker-01/outbound)@50%,0<br>  graphics: `{"ground":"ground--asphalt","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"},{"id":"bikes--biker-02-inbound","offsetX":"-50%"},{"id":"bikes--biker-01-outbound","offsetX":"50%"}]}`
- `twoway-right|regular|road` (Two-way bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane"}`<br>  components: lanes: asphalt(color=regular); markings: markings--twoway-right; vehicles: bike(type\|direction=biker-02/inbound)@50%,0 bike(type\|direction=biker-01/outbound)@-50%,0<br>  graphics: `{"ground":"ground--asphalt","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"},{"id":"bikes--biker-02-inbound","offsetX":"50%"},{"id":"bikes--biker-01-outbound","offsetX":"-50%"}]}`
- `inbound|green|road` (Bike lane) elev=0 [asphalt] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=green); markings: markings--straight-inbound-light; vehicles: bike(type\|direction=biker-01/inbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--straight-inbound-light","bikes--biker-01-inbound"]}`
- `outbound|green|road` (Bike lane) elev=0 [asphalt] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=green); markings: markings--straight-outbound-light; vehicles: bike(type\|direction=biker-01/outbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--straight-outbound-light","bikes--biker-01-outbound"]}`
- `twoway-left|green|road` (Two-way bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=green); markings: markings--twoway-left; vehicles: bike(type\|direction=biker-02/inbound)@-50%,0 bike(type\|direction=biker-01/outbound)@50%,0<br>  graphics: `{"ground":"ground--asphalt-green","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"},{"id":"bikes--biker-02-inbound","offsetX":"-50%"},{"id":"bikes--biker-01-outbound","offsetX":"50%"}]}`
- `twoway-right|green|road` (Two-way bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=green); markings: markings--twoway-right; vehicles: bike(type\|direction=biker-02/inbound)@50%,0 bike(type\|direction=biker-01/outbound)@-50%,0<br>  graphics: `{"ground":"ground--asphalt-green","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"},{"id":"bikes--biker-02-inbound","offsetX":"50%"},{"id":"bikes--biker-01-outbound","offsetX":"-50%"}]}`
- `inbound|red|road` (Bike lane) elev=0 [asphalt] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=red); markings: markings--straight-inbound-light; vehicles: bike(type\|direction=biker-01/inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","bikes--biker-01-inbound"]}`
- `outbound|red|road` (Bike lane) elev=0 [asphalt] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=red); markings: markings--straight-outbound-light; vehicles: bike(type\|direction=biker-01/outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","bikes--biker-01-outbound"]}`
- `twoway-left|red|road` (Two-way bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=red); markings: markings--twoway-left; vehicles: bike(type\|direction=biker-02/inbound)@-50%,0 bike(type\|direction=biker-01/outbound)@50%,0<br>  graphics: `{"ground":"ground--asphalt-red","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"},{"id":"bikes--biker-02-inbound","offsetX":"-50%"},{"id":"bikes--biker-01-outbound","offsetX":"50%"}]}`
- `twoway-right|red|road` (Two-way bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: asphalt(color=red); markings: markings--twoway-right; vehicles: bike(type\|direction=biker-02/inbound)@50%,0 bike(type\|direction=biker-01/outbound)@-50%,0<br>  graphics: `{"ground":"ground--asphalt-red","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"},{"id":"bikes--biker-02-inbound","offsetX":"50%"},{"id":"bikes--biker-01-outbound","offsetX":"-50%"}]}`
- `inbound|regular|sidewalk` (Bike lane) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=black); markings: markings--straight-inbound-light; vehicles: bike(type\|direction=biker-01/inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","bikes--biker-01-inbound"]}`
- `outbound|regular|sidewalk` (Bike lane) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=black); markings: markings--straight-outbound-light; vehicles: bike(type\|direction=biker-01/outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","bikes--biker-01-outbound"]}`
- `twoway-left|regular|sidewalk` (Two-way bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane"}`<br>  components: lanes: sidewalk(color=black); markings: markings--twoway-left; vehicles: bike(type\|direction=biker-02/inbound)@-50%,0 bike(type\|direction=biker-01/outbound)@50%,0<br>  graphics: `{"ground":"ground--asphalt","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"},{"id":"bikes--biker-02-inbound","offsetX":"-50%"},{"id":"bikes--biker-01-outbound","offsetX":"50%"}]}`
- `twoway-right|regular|sidewalk` (Two-way bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane"}`<br>  components: lanes: sidewalk(color=black); markings: markings--twoway-right; vehicles: bike(type\|direction=biker-02/inbound)@50%,0 bike(type\|direction=biker-01/outbound)@-50%,0<br>  graphics: `{"ground":"ground--asphalt","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"},{"id":"bikes--biker-02-inbound","offsetX":"50%"},{"id":"bikes--biker-01-outbound","offsetX":"-50%"}]}`
- `inbound|green|sidewalk` (Bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=green); markings: markings--straight-inbound-light; vehicles: bike(type\|direction=biker-01/inbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--straight-inbound-light","bikes--biker-01-inbound"]}`
- `outbound|green|sidewalk` (Bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=green); markings: markings--straight-outbound-light; vehicles: bike(type\|direction=biker-01/outbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--straight-outbound-light","bikes--biker-01-outbound"]}`
- `twoway-left|green|sidewalk` (Two-way bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=green); markings: markings--twoway-left; vehicles: bike(type\|direction=biker-02/inbound)@-50%,0 bike(type\|direction=biker-01/outbound)@50%,0<br>  graphics: `{"ground":"ground--asphalt-green","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"},{"id":"bikes--biker-02-inbound","offsetX":"-50%"},{"id":"bikes--biker-01-outbound","offsetX":"50%"}]}`
- `twoway-right|green|sidewalk` (Two-way bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=green); markings: markings--twoway-right; vehicles: bike(type\|direction=biker-02/inbound)@50%,0 bike(type\|direction=biker-01/outbound)@-50%,0<br>  graphics: `{"ground":"ground--asphalt-green","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"},{"id":"bikes--biker-02-inbound","offsetX":"50%"},{"id":"bikes--biker-01-outbound","offsetX":"-50%"}]}`
- `inbound|red|sidewalk` (Bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=red); markings: markings--straight-inbound-light; vehicles: bike(type\|direction=biker-01/inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","bikes--biker-01-inbound"]}`
- `outbound|red|sidewalk` (Bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=red); markings: markings--straight-outbound-light; vehicles: bike(type\|direction=biker-01/outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","bikes--biker-01-outbound"]}`
- `twoway-left|red|sidewalk` (Two-way bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=red); markings: markings--twoway-left; vehicles: bike(type\|direction=biker-02/inbound)@-50%,0 bike(type\|direction=biker-01/outbound)@50%,0<br>  graphics: `{"ground":"ground--asphalt-red","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"},{"id":"bikes--biker-02-inbound","offsetX":"-50%"},{"id":"bikes--biker-01-outbound","offsetX":"50%"}]}`
- `twoway-right|red|sidewalk` (Two-way bike lane) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Two-way bike lane","nameKey":"twoway-bike-lane","description":{"key":"colored-bike-lane","image":"bike-lane-colored-01.jpg"}}`<br>  components: lanes: sidewalk(color=red); markings: markings--twoway-right; vehicles: bike(type\|direction=biker-02/inbound)@50%,0 bike(type\|direction=biker-01/outbound)@-50%,0<br>  graphics: `{"ground":"ground--asphalt-red","center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"},{"id":"bikes--biker-02-inbound","offsetX":"50%"},{"id":"bikes--biker-01-outbound","offsetX":"-50%"}]}`

#### `bikeshare` — Bikeshare station (4 variants)

- `left|road` (Bikeshare station) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left markings--lane-right; objects: bikeshare(orientation=left)<br>  graphics: `{"ground":"ground--asphalt","left":["markings--lane-left","bikes--bikeshare-left"],"right":"markings--lane-right"}`
- `right|road` (Bikeshare station) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left markings--lane-right; objects: bikeshare(orientation=right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","right":["markings--lane-right","bikes--bikeshare-right"]}`
- `left|sidewalk` (Bikeshare station) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bikeshare(orientation=left)<br>  graphics: `{"ground":"ground--concrete","left":"bikes--bikeshare-left"}`
- `right|sidewalk` (Bikeshare station) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: bikeshare(orientation=right)<br>  graphics: `{"ground":"ground--concrete","right":"bikes--bikeshare-right"}`

#### `food-truck` — Food truck (2 variants)

- `left` (Food truck) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: food-truck(orientation=left)<br>  graphics: `{"ground":"ground--asphalt","center":"vehicles--foodtruck-left"}`
- `right` (Food truck) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: food-truck(orientation=right)<br>  graphics: `{"ground":"ground--asphalt","center":"vehicles--foodtruck-right"}`

#### `flex-zone` — Flex zone (8 variants)

- `taxi|inbound|left` (Taxi loading zone) elev=0 [asphalt] **overrides** `{"name":"Taxi loading zone","nameKey":"taxi-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-right; vehicles: taxi(direction\|orientation=inbound/left)<br>  graphics: `{"ground":"ground--asphalt","right":"markings--lane-right","center":"vehicles--taxi-inbound-door-left"}`
- `taxi|inbound|right` (Taxi loading zone) elev=0 [asphalt] **overrides** `{"name":"Taxi loading zone","nameKey":"taxi-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left; vehicles: taxi(direction\|orientation=inbound/right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","center":"vehicles--taxi-inbound-door-right"}`
- `taxi|outbound|left` (Taxi loading zone) elev=0 [asphalt] **overrides** `{"name":"Taxi loading zone","nameKey":"taxi-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-right; vehicles: taxi(direction\|orientation=outbound/left)<br>  graphics: `{"ground":"ground--asphalt","right":"markings--lane-right","center":"vehicles--taxi-outbound-door-left"}`
- `taxi|outbound|right` (Taxi loading zone) elev=0 [asphalt] **overrides** `{"name":"Taxi loading zone","nameKey":"taxi-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left; vehicles: taxi(direction\|orientation=outbound/right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","center":"vehicles--taxi-outbound-door-right"}`
- `rideshare|inbound|left` (Rideshare loading zone) elev=0 [asphalt] **overrides** `{"name":"Rideshare loading zone","nameKey":"rideshare-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-right; vehicles: rideshare(direction\|orientation=inbound/left)<br>  graphics: `{"ground":"ground--asphalt","right":"markings--lane-right","center":"vehicles--rideshare-inbound-door-left"}`
- `rideshare|inbound|right` (Rideshare loading zone) elev=0 [asphalt] **overrides** `{"name":"Rideshare loading zone","nameKey":"rideshare-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left; vehicles: rideshare(direction\|orientation=inbound/right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","center":"vehicles--rideshare-inbound-door-right"}`
- `rideshare|outbound|left` (Rideshare loading zone) elev=0 [asphalt] **overrides** `{"name":"Rideshare loading zone","nameKey":"rideshare-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-right; vehicles: rideshare(direction\|orientation=outbound/left)<br>  graphics: `{"ground":"ground--asphalt","right":"markings--lane-right","center":"vehicles--rideshare-outbound-door-left"}`
- `rideshare|outbound|right` (Rideshare loading zone) elev=0 [asphalt] **overrides** `{"name":"Rideshare loading zone","nameKey":"rideshare-pick-up"}`<br>  components: lanes: asphalt(color=regular); markings: markings--lane-left; vehicles: rideshare(direction\|orientation=outbound/right)<br>  graphics: `{"ground":"ground--asphalt","left":"markings--lane-left","center":"vehicles--rideshare-outbound-door-right"}`

#### `flex-zone-curb` — Waiting area (4 variants)

- `sparse|left` (Waiting area) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: pickup-sign(orientation=right) person-waiting(orientation=right)<br>  graphics: `{"ground":"ground--concrete","left":"curb--pickup-sign-right","center":"curb--person-waiting-01-right"}`
- `sparse|right` (Waiting area) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: pickup-sign(orientation=left) person-waiting(orientation=left)<br>  graphics: `{"ground":"ground--concrete","right":"curb--pickup-sign-left","center":"curb--person-waiting-01-left"}`
- `empty|left` (Waiting area) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: pickup-sign(orientation=right)<br>  graphics: `{"ground":"ground--concrete","left":"curb--pickup-sign-right"}`
- `empty|right` (Waiting area) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: pickup-sign(orientation=left)<br>  graphics: `{"ground":"ground--concrete","right":"curb--pickup-sign-left"}`

#### `parking-lane` — Parking lane (14 variants)

- `inbound|left` (Parking lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--parking-left; vehicles: car(direction\|orientation=inbound/left)@-80,0<br>  graphics: `{"ground":"ground--asphalt","right":"markings--parking-left","left":{"id":"vehicles--car-inbound","offsetX":-80}}`
- `inbound|right` (Parking lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--parking-right; vehicles: car(direction\|orientation=inbound/right)@-80,0<br>  graphics: `{"ground":"ground--asphalt","left":"markings--parking-right","right":{"id":"vehicles--car-inbound","offsetX":-80}}`
- `outbound|left` (Parking lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--parking-left; vehicles: car(direction\|orientation=outbound/left)@-80,0<br>  graphics: `{"ground":"ground--asphalt","right":"markings--parking-left","left":{"id":"vehicles--car-outbound","offsetX":-80}}`
- `outbound|right` (Parking lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--parking-right; vehicles: car(direction\|orientation=outbound/right)@-80,0<br>  graphics: `{"ground":"ground--asphalt","left":"markings--parking-right","right":{"id":"vehicles--car-outbound","offsetX":-80}}`
- `sideways|left` (Perpendicular parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":6,"imperial":20},"name":"Perpendicular parking","nameKey":"perpendicular-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=sideways/left)<br>  graphics: `{"ground":"ground--asphalt","left":"vehicles--car-sideways-left"}`
- `sideways|right` (Perpendicular parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":6,"imperial":20},"name":"Perpendicular parking","nameKey":"perpendicular-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=sideways/right)<br>  graphics: `{"ground":"ground--asphalt","right":"vehicles--car-sideways-right"}`
- `angled-front-left|left` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-front-left/left)<br>  graphics: `{"ground":"ground--asphalt","left":"vehicles--car-angled-front-left"}`
- `angled-front-right|left` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-front-right/left)<br>  graphics: `{"ground":"ground--asphalt","left":"vehicles--car-angled-front-right"}`
- `angled-rear-left|left` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-rear-left/left)<br>  graphics: `{"ground":"ground--asphalt","left":"vehicles--car-angled-rear-left"}`
- `angled-rear-right|left` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-rear-right/left)<br>  graphics: `{"ground":"ground--asphalt","left":"vehicles--car-angled-rear-right"}`
- `angled-front-left|right` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-front-left/right)<br>  graphics: `{"ground":"ground--asphalt","right":"vehicles--car-angled-front-left"}`
- `angled-front-right|right` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-front-right/right)<br>  graphics: `{"ground":"ground--asphalt","right":"vehicles--car-angled-front-right"}`
- `angled-rear-left|right` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-rear-left/right)<br>  graphics: `{"ground":"ground--asphalt","right":"vehicles--car-angled-rear-left"}`
- `angled-rear-right|right` (Angled parking) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":4.2,"imperial":14},"maxWidth":{"metric":5.4,"imperial":18},"name":"Angled parking","nameKey":"angled-parking"}`<br>  components: lanes: asphalt(color=regular); vehicles: car(direction\|orientation=angled-rear-right/right)<br>  graphics: `{"ground":"ground--asphalt","right":"vehicles--car-angled-rear-right"}`

#### `drive-lane` — Drive lane (20 variants)

- `inbound|car` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: car(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","vehicles--car-inbound"]}`
- `outbound|car` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: car(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","vehicles--car-outbound"]}`
- `inbound|car-with-bus` (Mixed-traffic drive lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Mixed-traffic drive lane","nameKey":"mixed-drive-lane"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: bus-alt(direction=inbound) car(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","transit--bus-inbound-alt","vehicles--car-inbound"]}`
- `outbound|car-with-bus` (Mixed-traffic drive lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"name":"Mixed-traffic drive lane","nameKey":"mixed-drive-lane"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: bus-alt(direction=outbound) car(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","transit--bus-outbound-alt","vehicles--car-outbound"]}`
- `inbound|car-with-bike` (Mixed-traffic drive lane) elev=0 [asphalt] **overrides** `{"dangerous":true,"name":"Mixed-traffic drive lane","nameKey":"mixed-drive-lane"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: car(direction=inbound) bike(type\|direction=biker-02/inbound)@30,0; effects: biker-stress(type=sweat-drop)@20,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","vehicles--car-inbound",{"id":"bikes--biker-02-inbound","offsetX":30},{"id":"effects--sweat-drop","offsetX":20}]}`
- `outbound|car-with-bike` (Mixed-traffic drive lane) elev=0 [asphalt] **overrides** `{"dangerous":true,"name":"Mixed-traffic drive lane","nameKey":"mixed-drive-lane"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: car(direction=outbound) bike(type\|direction=biker-02/outbound)@-30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","vehicles--car-outbound",{"id":"bikes--biker-02-outbound","offsetX":-30}]}`
- `inbound|sharrow` (Sharrow) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Sharrow","nameKey":"sharrow","defaultWidth":{"metric":4.2,"imperial":14},"description":{"key":"sharrow","image":"sharrow-01.jpg"}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-inbound; vehicles: car(direction=inbound) bike(type\|direction=biker-02/inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-inbound","vehicles--car-inbound","bikes--biker-02-inbound"]}`
- `outbound|sharrow` (Sharrow) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Sharrow","nameKey":"sharrow","defaultWidth":{"metric":4.2,"imperial":14},"description":{"key":"sharrow","image":"sharrow-01.jpg"}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-outbound; vehicles: car(direction=outbound) bike(type\|direction=biker-02/outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-outbound","vehicles--car-outbound","bikes--biker-02-outbound"]}`
- `inbound|bus` (Drive lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10}}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","transit--bus-inbound"]}`
- `outbound|bus` (Drive lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10}}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","transit--bus-outbound"]}`
- `inbound|truck` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: truck(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","vehicles--truck-inbound"]}`
- `outbound|truck` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: truck(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","vehicles--truck-outbound"]}`
- `inbound|microvan` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: microvan(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","vehicles--microvan-inbound"]}`
- `outbound|microvan` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: microvan(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","vehicles--microvan-outbound"]}`
- `inbound|av` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: av(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","vehicles--av-inbound"]}`
- `outbound|av` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: av(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","vehicles--av-outbound"]}`
- `inbound|motorcycle-sidecar` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: motorcycle-sidecar(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","vehicles--krz-motorbike-inbound"]}`
- `outbound|motorcycle-sidecar` (Drive lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: motorcycle-sidecar(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","vehicles--krz-motorbike-outbound"]}`
- `inbound|pedestrian` (Pedestrian) elev=0 [asphalt] **overrides** `{"name":"Pedestrian","nameKey":"pedestrian"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: pedestrian(density=normal)<br>  graphics: `{"ground":"ground--asphalt","center":"markings--straight-inbound-light","scatter":{"pool":"people","minSpacing":0,"maxSpacing":1.5,"padding":0.5}}`
- `outbound|pedestrian` (Pedestrian) elev=0 [asphalt] **overrides** `{"name":"Pedestrian","nameKey":"pedestrian"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: pedestrian(density=normal)<br>  graphics: `{"ground":"ground--asphalt","center":"markings--straight-outbound-light","scatter":{"pool":"people","minSpacing":0,"maxSpacing":1.5,"padding":0.5}}`

#### `turn-lane` — Turn lane (16 variants)

- `inbound|left` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--left-inbound; vehicles: car(direction\|turn-orientation=inbound/right)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--left-inbound","vehicles--car-inbound-turn-signal-right"]}`
- `inbound|left-straight` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--left-straight-inbound; vehicles: car(direction\|turn-orientation=inbound/right)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--left-straight-inbound","vehicles--car-inbound-turn-signal-right"]}`
- `inbound|straight` (No turn lane) elev=0 [asphalt] **overrides** `{"name":"No turn lane","nameKey":"turn-lane-straight"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound; vehicles: car(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound","vehicles--car-inbound"]}`
- `inbound|right-straight` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--right-straight-inbound; vehicles: car(direction\|turn-orientation=inbound/left)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--right-straight-inbound","vehicles--car-inbound-turn-signal-left"]}`
- `inbound|right` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--right-inbound; vehicles: car(direction\|turn-orientation=inbound/left)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--right-inbound","vehicles--car-inbound-turn-signal-left"]}`
- `inbound|both` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--both-inbound; vehicles: car(direction\|turn-orientation=inbound/right)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--both-inbound","vehicles--car-inbound-turn-signal-right"]}`
- `inbound|left-right-straight` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--left-right-straight-inbound; vehicles: car(direction\|turn-orientation=inbound/right)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--left-right-straight-inbound","vehicles--car-inbound-turn-signal-right"]}`
- `inbound|shared` (Center turn lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"maxWidth":{"metric":4.8,"imperial":16},"name":"Center turn lane","nameKey":"turn-lane-center","defaultWidth":{"metric":3.6,"imperial":12}}`<br>  components: lanes: asphalt(color=regular); markings: markings--shared-inbound markings--center-lane-left markings--center-lane-right<br>  graphics: `{"ground":"ground--asphalt","center":"markings--shared-inbound","left":"markings--center-lane-left","right":"markings--center-lane-right"}`
- `outbound|left` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--left-outbound; vehicles: car(direction\|turn-orientation=outbound/left)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--left-outbound","vehicles--car-outbound-turn-signal-left"]}`
- `outbound|left-straight` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--left-straight-outbound; vehicles: car(direction\|turn-orientation=outbound/left)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--left-straight-outbound","vehicles--car-outbound-turn-signal-left"]}`
- `outbound|straight` (No turn lane) elev=0 [asphalt] **overrides** `{"name":"No turn lane","nameKey":"turn-lane-straight"}`<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound; vehicles: car(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound","vehicles--car-outbound"]}`
- `outbound|right-straight` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--right-straight-outbound; vehicles: car(direction\|turn-orientation=outbound/right)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--right-straight-outbound","vehicles--car-outbound-turn-signal-right"]}`
- `outbound|right` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--right-outbound; vehicles: car(direction\|turn-orientation=outbound/right)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--right-outbound","vehicles--car-outbound-turn-signal-right"]}`
- `outbound|both` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--both-outbound; vehicles: car(direction\|turn-orientation=outbound/left)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--both-outbound","vehicles--car-outbound-turn-signal-left"]}`
- `outbound|left-right-straight` (Turn lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--left-right-straight-outbound; vehicles: car(direction\|turn-orientation=outbound/left)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--left-right-straight-outbound","vehicles--car-outbound-turn-signal-left"]}`
- `outbound|shared` (Center turn lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3,"imperial":10},"maxWidth":{"metric":4.8,"imperial":16},"name":"Center turn lane","nameKey":"turn-lane-center","defaultWidth":{"metric":3.6,"imperial":12}}`<br>  components: lanes: asphalt(color=regular); markings: markings--shared-outbound markings--center-lane-left markings--center-lane-right<br>  graphics: `{"ground":"ground--asphalt","center":"markings--shared-outbound","left":"markings--center-lane-left","right":"markings--center-lane-right"}`

#### `bus-lane` — Bus lane (18 variants)

- `inbound|regular|typical` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","transit--bus-inbound"]}`
- `outbound|regular|typical` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","transit--bus-outbound"]}`
- `inbound|colored|typical` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-inbound-light; vehicles: bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","transit--bus-inbound"]}`
- `outbound|colored|typical` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-outbound-light; vehicles: bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","transit--bus-outbound"]}`
- `inbound|shared|typical` (Shared bus/bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Shared bus/bike lane","nameKey":"bus-lane-shared","defaultWidth":{"metric":4.2,"imperial":14}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-inbound markings--lane-left markings--lane-right; vehicles: bus(direction=inbound) bike(type\|direction=biker-02/inbound)@30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-inbound","transit--bus-inbound",{"id":"bikes--biker-02-inbound","offsetX":30}],"left":"markings--lane-left","right":"markings--lane-right"}`
- `outbound|shared|typical` (Shared bus/bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Shared bus/bike lane","nameKey":"bus-lane-shared","defaultWidth":{"metric":4.2,"imperial":14}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-outbound markings--lane-left markings--lane-right; vehicles: bus(direction=outbound) bike(type\|direction=biker-02/outbound)@-30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-outbound","transit--bus-outbound",{"id":"bikes--biker-02-outbound","offsetX":-30}],"left":"markings--lane-left","right":"markings--lane-right"}`
- `inbound|regular|double-decker` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: double-decker-bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","transit--double-decker-bus-inbound"]}`
- `outbound|regular|double-decker` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: double-decker-bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","transit--double-decker-bus-outbound"]}`
- `inbound|colored|double-decker` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-inbound-light; vehicles: double-decker-bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","transit--double-decker-bus-inbound"]}`
- `outbound|colored|double-decker` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-outbound-light; vehicles: double-decker-bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","transit--double-decker-bus-outbound"]}`
- `inbound|shared|double-decker` (Shared bus/bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Shared bus/bike lane","nameKey":"bus-lane-shared","defaultWidth":{"metric":4.2,"imperial":14}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-inbound markings--lane-left markings--lane-right; vehicles: double-decker-bus(direction=inbound) bike(type\|direction=biker-02/inbound)@30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-inbound","transit--double-decker-bus-inbound",{"id":"bikes--biker-02-inbound","offsetX":30}],"left":"markings--lane-left","right":"markings--lane-right"}`
- `outbound|shared|double-decker` (Shared bus/bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Shared bus/bike lane","nameKey":"bus-lane-shared","defaultWidth":{"metric":4.2,"imperial":14}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-outbound markings--lane-left markings--lane-right; vehicles: double-decker-bus(direction=outbound) bike(type\|direction=biker-02/outbound)@-30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-outbound","transit--double-decker-bus-outbound",{"id":"bikes--biker-02-outbound","offsetX":-30}],"left":"markings--lane-left","right":"markings--lane-right"}`
- `inbound|regular|av-shuttle` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: av-shuttle(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","transit--av-shuttle-inbound"]}`
- `outbound|regular|av-shuttle` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: av-shuttle(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","transit--av-shuttle-outbound"]}`
- `inbound|colored|av-shuttle` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-inbound-light; vehicles: av-shuttle(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","transit--av-shuttle-inbound"]}`
- `outbound|colored|av-shuttle` (Bus lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-outbound-light; vehicles: av-shuttle(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","transit--av-shuttle-outbound"]}`
- `inbound|shared|av-shuttle` (Shared bus/bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Shared bus/bike lane","nameKey":"bus-lane-shared","defaultWidth":{"metric":4.2,"imperial":14}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-inbound markings--lane-left markings--lane-right; vehicles: av-shuttle(direction=inbound) bike(type\|direction=biker-02/inbound)@30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-inbound","transit--av-shuttle-inbound",{"id":"bikes--biker-02-inbound","offsetX":30}],"left":"markings--lane-left","right":"markings--lane-right"}`
- `outbound|shared|av-shuttle` (Shared bus/bike lane) elev=0 [asphalt] **overrides** `{"minWidth":{"metric":3.6,"imperial":12},"maxWidth":{"metric":4.2,"imperial":14},"name":"Shared bus/bike lane","nameKey":"bus-lane-shared","defaultWidth":{"metric":4.2,"imperial":14}}`<br>  components: lanes: asphalt(color=regular); markings: markings--sharrow-outbound markings--lane-left markings--lane-right; vehicles: av-shuttle(direction=outbound) bike(type\|direction=biker-02/outbound)@-30,0<br>  graphics: `{"ground":"ground--asphalt","center":["markings--sharrow-outbound","transit--av-shuttle-outbound",{"id":"bikes--biker-02-outbound","offsetX":-30}],"left":"markings--lane-left","right":"markings--lane-right"}`

#### `streetcar` — Streetcar (6 variants)

- `inbound|regular` (Streetcar) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--streetcar-track-01 markings--straight-inbound-light; vehicles: streetcar(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--streetcar-track-01","markings--straight-inbound-light","transit--streetcar-inbound"]}`
- `outbound|regular` (Streetcar) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--streetcar-track-01 markings--straight-outbound-light; vehicles: streetcar(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--streetcar-track-01","markings--straight-outbound-light","transit--streetcar-outbound"]}`
- `inbound|colored` (Streetcar) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--streetcar-track-02 markings--straight-inbound-light; vehicles: streetcar(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--streetcar-track-02","markings--straight-inbound-light","transit--streetcar-inbound"]}`
- `outbound|colored` (Streetcar) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--streetcar-track-02 markings--straight-outbound-light; vehicles: streetcar(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--streetcar-track-02","markings--straight-outbound-light","transit--streetcar-outbound"]}`
- `inbound|grass` (Streetcar) elev=0 [asphalt]<br>  components: lanes: asphalt(color=green); markings: markings--streetcar-track-02 markings--straight-inbound-light; objects: planting-strip(type=grass); vehicles: streetcar(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--streetcar-track-02","markings--straight-inbound-light","transit--streetcar-inbound"],"repeat":"plants--grass"}`
- `outbound|grass` (Streetcar) elev=0 [asphalt]<br>  components: lanes: asphalt(color=green); markings: markings--streetcar-track-02 markings--straight-outbound-light; objects: planting-strip(type=grass); vehicles: streetcar(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-green","center":["markings--streetcar-track-02","markings--straight-outbound-light","transit--streetcar-outbound"],"repeat":"plants--grass"}`

#### `light-rail` — Light rail (6 variants)

- `inbound|regular` (Light rail) elev=0 [asphalt]<br>  components: lanes: asphalt(color=gray); markings: markings--streetcar-track-02 markings--straight-inbound-light; vehicles: light-rail(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-gray","center":["markings--streetcar-track-02","markings--straight-inbound-light","transit--light-rail-inbound"]}`
- `outbound|regular` (Light rail) elev=0 [asphalt]<br>  components: lanes: asphalt(color=gray); markings: markings--streetcar-track-02 markings--straight-outbound-light; vehicles: light-rail(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-gray","center":["markings--streetcar-track-02","markings--straight-outbound-light","transit--light-rail-outbound"]}`
- `inbound|colored` (Light rail) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--streetcar-track-02 markings--straight-inbound-light; vehicles: light-rail(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--streetcar-track-02","markings--straight-inbound-light","transit--light-rail-inbound"]}`
- `outbound|colored` (Light rail) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--streetcar-track-02 markings--straight-outbound-light; vehicles: light-rail(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--streetcar-track-02","markings--straight-outbound-light","transit--light-rail-outbound"]}`
- `inbound|grass` (Light rail) elev=0 [asphalt]<br>  components: lanes: asphalt(color=green); objects: planting-strip(type=grass); markings: markings--streetcar-track-02 markings--straight-inbound-light; vehicles: light-rail(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-green","repeat":"plants--grass","center":["markings--streetcar-track-02","markings--straight-inbound-light","transit--light-rail-inbound"]}`
- `outbound|grass` (Light rail) elev=0 [asphalt]<br>  components: lanes: asphalt(color=green); objects: planting-strip(type=grass); markings: markings--streetcar-track-02 markings--straight-outbound-light; vehicles: light-rail(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-green","repeat":"plants--grass","center":["markings--streetcar-track-02","markings--straight-outbound-light","transit--light-rail-outbound"]}`

#### `transit-shelter` — Transit shelter (4 variants)

- `left|street-level` (Transit shelter) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: transit-shelter(type\|orientation=transit-shelter-01/left)<br>  graphics: `{"ground":"ground--concrete","left":"transit--transit-shelter-01-left"}`
- `right|street-level` (Transit shelter) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: transit-shelter(type\|orientation=transit-shelter-01/right)<br>  graphics: `{"ground":"ground--concrete","right":"transit--transit-shelter-01-right"}`
- `left|light-rail` (Transit shelter) elev=0.75m/2.5ft [raised-sidewalk] **overrides** `{"minWidth":{"metric":2.4,"imperial":8},"description":{"key":"transit-shelter-elevated","image":"transit-station-elevated.jpg"}}`<br>  components: lanes: raised-sidewalk(type=default); objects: transit-shelter(type\|orientation=transit-shelter-02/left)<br>  graphics: `{"ground":"ground--concrete","left":"transit--transit-shelter-02-left"}`
- `right|light-rail` (Transit shelter) elev=0.75m/2.5ft [raised-sidewalk] **overrides** `{"minWidth":{"metric":2.4,"imperial":8},"description":{"key":"transit-shelter-elevated","image":"transit-station-elevated.jpg"}}`<br>  components: lanes: raised-sidewalk(type=default); objects: transit-shelter(type\|orientation=transit-shelter-02/right)<br>  graphics: `{"ground":"ground--concrete","right":"transit--transit-shelter-02-right"}`

#### `brt-station` — BRT station (3 variants)

- `left` (BRT station) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10}}`<br>  components: lanes: sidewalk(color=regular); objects: brt-station(orientation=left)<br>  graphics: `{"ground":"ground--concrete","quirks":{"minWidth":2},"repeat":{"id":"transit--brt-station-piece-center","padding":0.5},"left":"transit--brt-station-piece-left-edge","right":"transit--brt-station-piece-right-platform","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.75,"originY":-45,"padding":2}}`
- `right` (BRT station) elev=0.15m/0.5ft [sidewalk] **overrides** `{"minWidth":{"metric":3,"imperial":10}}`<br>  components: lanes: sidewalk(color=regular); objects: brt-station(orientation=right)<br>  graphics: `{"ground":"ground--concrete","quirks":{"minWidth":2},"repeat":{"id":"transit--brt-station-piece-center","padding":0.5},"right":"transit--brt-station-piece-right-edge","left":"transit--brt-station-piece-left-platform","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.75,"originY":-45,"padding":2}}`
- `center` (BRT station) elev=0.15m/0.5ft [sidewalk]<br>  components: lanes: sidewalk(color=regular); objects: brt-station(orientation=center)<br>  graphics: `{"ground":"ground--concrete","quirks":{"minWidth":2},"repeat":{"id":"transit--brt-station-piece-center","padding":0.5},"left":"transit--brt-station-piece-left-platform","right":"transit--brt-station-piece-right-platform","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.75,"originY":-45,"padding":2}}`

#### `brt-lane` — Bus rapid transit lane (4 variants)

- `inbound|regular` (Bus rapid transit lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-inbound-light; vehicles: brt-bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-inbound-light","transit--brt-bus-inbound"]}`
- `outbound|regular` (Bus rapid transit lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); markings: markings--straight-outbound-light; vehicles: brt-bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt","center":["markings--straight-outbound-light","transit--brt-bus-outbound"]}`
- `inbound|red` (Bus rapid transit lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-inbound-light; vehicles: brt-bus(direction=inbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-inbound-light","transit--brt-bus-inbound"]}`
- `outbound|red` (Bus rapid transit lane) elev=0 [asphalt]<br>  components: lanes: asphalt(color=red); markings: markings--straight-outbound-light; vehicles: brt-bus(direction=outbound)<br>  graphics: `{"ground":"ground--asphalt-red","center":["markings--straight-outbound-light","transit--brt-bus-outbound"]}`

#### `train` — “Inception” train (1 variants)

- `''` (“Inception” train) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: train(type=default)<br>  graphics: `{"ground":"ground--asphalt","center":"secret--inception-train"}`

#### `magic-carpet` — Magic carpet (4 variants)

- `aladdin` (Magic carpet) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: magic-carpet(magic-carpet-occupants=aladdin)<br>  graphics: `{"ground":"ground--asphalt","center":{"id":"vehicles--magic-carpet-aladdin","originY":-325}}`
- `jasmine` (Magic carpet) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: magic-carpet(magic-carpet-occupants=jasmine)<br>  graphics: `{"ground":"ground--asphalt","center":{"id":"vehicles--magic-carpet-jasmine","originY":-325}}`
- `aladdin-jasmine` (Magic carpet) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: magic-carpet(magic-carpet-occupants=aladdin-jasmine)<br>  graphics: `{"ground":"ground--asphalt","center":{"id":"vehicles--magic-carpet-aladdin-jasmine","originY":-325}}`
- `jasmine-aladdin` (Magic carpet) elev=0 [asphalt]<br>  components: lanes: asphalt(color=regular); vehicles: magic-carpet(magic-carpet-occupants=jasmine-aladdin)<br>  graphics: `{"ground":"ground--asphalt","center":{"id":"vehicles--magic-carpet-jasmine-aladdin","originY":-325}}`

#### `beach` — Beach (2 variants)

- `beach` (Beach) elev=0 [beach]<br>  components: lanes: beach(type=default)<br>  graphics: `{"repeat":"beach--surface","ground":"ground--sand"}`
- `lounger` (Beach) elev=0 [beach]<br>  components: lanes: beach(type=default); objects: beach-lounger(type=default)@50,0<br>  graphics: `{"repeat":"beach--surface","ground":"ground--sand","center":{"id":"beach--lounger","offsetX":50}}`

#### `marsh` — Marsh (1 variants)

- `marsh` (Marsh) elev=0 [earth]<br>  components: lanes: earth(type=default); objects: marsh-grass(type=default)<br>  graphics: `{"repeat":"earth--surface","ground":"ground--earth","scatter":{"sprites":["plants--marsh-grass-01","plants--marsh-grass-02","plants--marsh-grass-03","plants--marsh-grass-04","plants--marsh-grass-05"],"minSpacing":-0.75,"maxSpacing":0.35,"padding":0.25}}`

#### `wall` — Wall (2 variants)

- `low` (Wall) elev=0 [wall]<br>  components: lanes: wall(type=default); objects: wall(wall-height=low)<br>  graphics: `{"ground":"ground--wall","quirks":{"minWidth":0.5},"repeat":{"id":"wall--wall-low-center","padding":0.2},"left":{"id":"wall--wall-low-left-sloped","offsetX":0},"right":{"id":"wall--wall-low-right-sloped","offsetX":0}}`
- `high` (Wall) elev=0 [wall]<br>  components: lanes: wall(type=default); objects: wall(wall-height=high)<br>  graphics: `{"ground":"ground--wall","quirks":{"minWidth":0.5},"repeat":{"id":"wall--wall-high-center","padding":0.2},"left":{"id":"wall--wall-high-left-sloped","offsetX":0},"right":{"id":"wall--wall-high-right-sloped","offsetX":0}}`

#### `guardrail` — Guard rail (1 variants)

- `default` (Guard rail) elev=0.15m/0.5ft [sidewalk] **overrides** `{"slope":"berm","name":"Guard rail","nameKey":"guardrail"}`<br>  components: lanes: sidewalk(color=regular); objects: guardrail(type=default)<br>  graphics: `{"ground":"ground--concrete","center":"dividers--guardrail"}`

#### `slope` — Slope (2 variants)

- `grass` (Grassy hill) elev=0.15m/0.5ft [sidewalk] **overrides** `{"name":"Grassy hill","nameKey":"grass-hill"}`<br>  components: lanes: sidewalk(color=regular); objects: planting-strip(type=grass)<br>  graphics: `{"ground":"ground--concrete","repeat":"plants--grass"}`
- `dune` (Sand dune) elev=0 [beach] **overrides** `{"name":"Sand dune","nameKey":"sand-dune"}`<br>  components: lanes: beach(type=default); objects: marsh-grass(type=default)<br>  graphics: `{"repeat":"beach--surface","ground":"ground--sand","scatter":{"sprites":["plants--marsh-grass-01","plants--marsh-grass-02","plants--marsh-grass-03","plants--marsh-grass-04","plants--marsh-grass-05"],"minSpacing":-0.75,"maxSpacing":0.35,"padding":0.25}}`


### 1.7 Components (`components.yaml`)


**lanes** (7)

| id | props | variant leaves → graphics |
|---|---|---|
| `asphalt` | `{"elevation":0}` | `color/regular` → `{"ground":"ground--asphalt"}`<br>`color/red` → `{"ground":"ground--asphalt-red"}`<br>`color/green` → `{"ground":"ground--asphalt-green"}`<br>`color/gray` → `{"ground":"ground--asphalt-gray"}` |
| `sidewalk` | `{"elevation":{"metric":0.15,"imperial":0.5}}` | `color/regular` → `{"ground":"ground--concrete"}`<br>`color/black` → `{"ground":"ground--asphalt"}`<br>`color/red` → `{"ground":"ground--asphalt-red"}`<br>`color/green` → `{"ground":"ground--asphalt-green"}`<br>`color/gray` → `{"ground":"ground--asphalt-gray"}`<br>`density/empty` → `{"ground":"ground--concrete"}` |
| `raised-sidewalk` | `{"elevation":{"metric":0.75,"imperial":2.5}}` | `type/default` → `{"ground":"ground--concrete"}` |
| `drainage` | `{"elevation":0}` | `color/regular` → `{"ground":"ground--concrete"}` |
| `beach` | `{"elevation":0}` | `type/default` → `{"repeat":"beach--surface","ground":"ground--sand"}` |
| `earth` | `{"elevation":0}` | `type/default` → `{"repeat":"earth--surface","ground":"ground--earth"}`<br>`type/flat` → `{"ground":"ground--earth"}` |
| `wall` | `{"elevation":0}` | `type/default` → `{"ground":"ground--wall"}` |

**markings** (36)

| id | props | variant leaves → graphics |
|---|---|---|
| `markings--lane-right` | `{"graphics":{"right":"markings--lane-right"}}` | — |
| `markings--lane-left` | `{"graphics":{"left":"markings--lane-left"}}` | — |
| `markings--straight-inbound-light` | `{"graphics":{"center":"markings--straight-inbound-light"}}` | — |
| `markings--straight-outbound-light` | `{"graphics":{"center":"markings--straight-outbound-light"}}` | — |
| `markings--lane-left-half` | `{"graphics":{"left":"markings--lane-left-half"}}` | — |
| `markings--lane-right-half` | `{"graphics":{"right":"markings--lane-right-half"}}` | — |
| `markings--lane-horiz` | `{"graphics":{"repeat":"markings--lane-horiz"}}` | — |
| `markings--sharrow-inbound` | `{"graphics":{"center":"markings--sharrow-inbound"}}` | — |
| `markings--sharrow-outbound` | `{"graphics":{"center":"markings--sharrow-outbound"}}` | — |
| `markings--left-inbound` | `{"graphics":{"center":"markings--left-inbound"}}` | — |
| `markings--left-straight-inbound` | `{"graphics":{"center":"markings--left-straight-inbound"}}` | — |
| `markings--straight-inbound` | `{"graphics":{"center":"markings--straight-inbound"}}` | — |
| `markings--right-straight-inbound` | `{"graphics":{"center":"markings--right-straight-inbound"}}` | — |
| `markings--right-inbound` | `{"graphics":{"center":"markings--right-inbound"}}` | — |
| `markings--both-inbound` | `{"graphics":{"center":"markings--both-inbound"}}` | — |
| `markings--left-right-straight-inbound` | `{"graphics":{"center":"markings--left-right-straight-inbound"}}` | — |
| `markings--shared-inbound` | `{"graphics":{"center":"markings--shared-inbound"}}` | — |
| `markings--center-lane-left` | `{"graphics":{"left":"markings--center-lane-left"}}` | — |
| `markings--center-lane-right` | `{"graphics":{"right":"markings--center-lane-right"}}` | — |
| `markings--left-outbound` | `{"graphics":{"center":"markings--left-outbound"}}` | — |
| `markings--left-straight-outbound` | `{"graphics":{"center":"markings--left-straight-outbound"}}` | — |
| `markings--straight-outbound` | `{"graphics":{"center":"markings--straight-outbound"}}` | — |
| `markings--right-straight-outbound` | `{"graphics":{"center":"markings--right-straight-outbound"}}` | — |
| `markings--right-outbound` | `{"graphics":{"center":"markings--right-outbound"}}` | — |
| `markings--both-outbound` | `{"graphics":{"center":"markings--both-outbound"}}` | — |
| `markings--left-right-straight-outbound` | `{"graphics":{"center":"markings--left-right-straight-outbound"}}` | — |
| `markings--shared-outbound` | `{"graphics":{"center":"markings--shared-outbound"}}` | — |
| `markings--streetcar-track-01` | `{"graphics":{"center":"markings--streetcar-track-01"}}` | — |
| `markings--streetcar-track-02` | `{"graphics":{"center":"markings--streetcar-track-02"}}` | — |
| `markings--stripes-diagonal` | `{"graphics":{"repeat":"markings--stripes-diagonal"}}` | — |
| `markings--parking-left` | `{"graphics":{"right":"markings--parking-left"}}` | — |
| `markings--parking-right` | `{"graphics":{"left":"markings--parking-right"}}` | — |
| `markings--twoway-left` | `{"graphics":{"center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"-50%"},{"id":"markings--straight-outbound-light","offsetX":"50%"}]}}` | — |
| `markings--twoway-right` | `{"graphics":{"center":[{"id":"markings--center-lane"},{"id":"markings--straight-inbound-light","offsetX":"50%"},{"id":"markings--straight-outbound-light","offsetX":"-50%"}]}}` | — |
| `markings--crosswalk-zebra` | `{"graphics":{"repeat":"markings--crosswalk-zebra"}}` | — |
| `markings--crosswalk-zebra-bike` | `{"graphics":{"repeat":"markings--crosswalk-zebra-bike"}}` | — |

**objects** (28)

| id | props | variant leaves → graphics |
|---|---|---|
| `pickup-sign` | `{"name":"Pickup sign","nameKey":"pickup-sign","owner":"FURNITURE","zIndex":30}` | `orientation/left` → `{"right":"curb--pickup-sign-left"}`<br>`orientation/right` → `{"left":"curb--pickup-sign-right"}` |
| `person-waiting` | `{"name":"Person waiting","nameKey":"person-waiting","zIndex":30}` | `orientation/left` → `{"center":"curb--person-waiting-01-left"}`<br>`orientation/right` → `{"center":"curb--person-waiting-01-right"}` |
| `utility-pole` | `{"name":"Utility pole","nameKey":"utility-pole","owner":"UTILITY","zIndex":10}` | `orientation/left` → `{"center":"utilities--utility-pole-left"}`<br>`orientation/right` → `{"center":"utilities--utility-pole-right"}` |
| `tree` | `{"name":"Tree","nameKey":"tree","owner":"NATURE","zIndex":22}` | `type/big` → `{"center":"trees--tree"}`<br>`type/palm-tree` → `{"center":"trees--palm-tree"}` |
| `bike-rack` | `{"name":"Bike rack","nameKey":"bike-rack","owner":"BIKE","zIndex":23}` | `direction|orientation/parallel/left` → `{"left":"bikes--bike-rack-parallel-left"}`<br>`direction|orientation/parallel/right` → `{"right":"bikes--bike-rack-parallel-right"}`<br>`direction|orientation/perpendicular/left` → `{"left":"bikes--bike-rack-perpendicular-left"}`<br>`direction|orientation/perpendicular/right` → `{"right":"bikes--bike-rack-perpendicular-right"}` |
| `bench` | `{"name":"Bench","nameKey":"bench","owner":"FURNITURE","zIndex":24}` | `orientation/left` → `{"left":"furniture--bench-left"}`<br>`orientation/center` → `{"center":"furniture--bench-center"}`<br>`orientation/right` → `{"right":"furniture--bench-right"}` |
| `outdoor-dining` | `{"name":"Outdoor dining","nameKey":"outdoor-dining","owner":"FURNITURE","zIndex":20}` | `occupants/occupied` → `{"center":"furniture--cafe-seating-occupied"}`<br>`occupants/empty` → `{"center":"furniture--cafe-seating"}` |
| `wayfinding-sign` | `{"name":"Wayfinding sign","nameKey":"wayfinding-sign","owner":"FURNITURE","zIndex":21}` | `type/small` → `{"center":"wayfinding--nyc-wayfinding-pylon-small"}`<br>`type/medium` → `{"center":"wayfinding--nyc-wayfinding-pylon-medium"}`<br>`type/large` → `{"center":"wayfinding--nyc-wayfinding-pylon-large"}` |
| `lamp` | `{"name":"Lamp","nameKey":"lamp","owner":"FURNITURE","zIndex":19}` | `type|orientation/modern/right` → `{"right":"lamps--lamp-modern-right"}`<br>`type|orientation/modern/left` → `{"left":"lamps--lamp-modern-left"}`<br>`type|orientation/modern/both` → `{"center":"lamps--lamp-modern-both"}`<br>`type|orientation/traditional/right` → `{"right":"lamps--lamp-traditional-right"}`<br>`type|orientation/traditional/left` → `{"left":"lamps--lamp-traditional-left"}`<br>`type|orientation/traditional/both` → `{"center":"lamps--lamp-traditional-center"}` |
| `pride-banner` | `{"name":"Pride banner","nameKey":"pride-banner"}` | `orientation/left` → `{"left":"lamps--pride-banner-left"}`<br>`orientation/right` → `{"right":"lamps--pride-banner-right"}`<br>`orientation/both` → `{"center":{"id":"lamps--pride-banner-left","offsetX":49}}` |
| `parklet` | `{"name":"Parklet","nameKey":"parklet","owner":"FURNITURE","zIndex":15}` | `orientation/left` → `{"left":"parklet--yerba-buena-parklet-left-v02"}`<br>`orientation/right` → `{"right":"parklet--yerba-buena-parklet-right-v02"}` |
| `street-vendor` | `{"name":"Street vendor","nameKey":"street-vendor","zIndex":24}` | `vendor-type/handcart` → `{"center":"vendors--vendor-handcart"}`<br>`vendor-type/platform` → `{"center":"vendors--vendor-platform"}`<br>`vendor-type/table` → `{"center":"vendors--vendor-table"}`<br>`vendor-type/tarp` → `{"center":"vendors--vendor-tarp"}` |
| `bikeshare` | `{"name":"Bikeshare station","nameKey":"bikeshare-station","owner":"FURNITURE","zIndex":21}` | `orientation/left` → `{"left":"bikes--bikeshare-left"}`<br>`orientation/right` → `{"right":"bikes--bikeshare-right"}` |
| `planting-strip` | `{"name":"Planting strip","nameKey":"planting-strip","owner":"NATURE","zIndex":20}` | `type/grass` → `{"repeat":"plants--grass"}`<br>`type/bush` → `{"scatter":{"sprites":["plants--bush"],"minSpacing":-1,"maxSpacing":1,"padding":0.5}}`<br>`type/flowers` → `{"scatter":{"sprites":["plants--flowers-red",{"id":"plants--flowers-orange","width":1,"disallowFirst":true,"weight":20},{"id":"plants--flowers-yellow","width":1,"disallowFirst":true},{"id":"plants--flowers-white","width":1,"disallowFirst":true,"weight":20},{"id":"plants--flowers-blue","width":1,"disallowFirst":true,"weight":10}],"minSpacing":-0.5,"maxSpacing":1,"padding":0.5}}` |
| `planter-box` | `{"name":"Planter box","nameKey":"planter-box","owner":"FURNITURE","zIndex":20}` | `type/default` → `{"center":"dividers--planter-box"}` |
| `bollard` | `{"name":"Bollard","nameKey":"bollard","zIndex":20}` | `type/default` → `{"center":"dividers--bollard"}` |
| `dome` | `{"name":"Traffic exclusion dome","nameKey":"dome","zIndex":20}` | `type/default` → `{"center":"dividers--dome"}` |
| `transit-shelter` | `{"name":"Transit shelter","nameKey":"transit-shelter","owner":"TRANSIT","zIndex":20}` | `type|orientation/transit-shelter-01/left` → `{"left":"transit--transit-shelter-01-left"}`<br>`type|orientation/transit-shelter-01/right` → `{"right":"transit--transit-shelter-01-right"}`<br>`type|orientation/transit-shelter-02/left` → `{"left":"transit--transit-shelter-02-left"}`<br>`type|orientation/transit-shelter-02/right` → `{"right":"transit--transit-shelter-02-right"}` |
| `brt-station` | `{"name":"BRT station","nameKey":"brt-station","owner":"TRANSIT","zIndex":20}` | `orientation/left` → `{"quirks":{"minWidth":2},"repeat":{"id":"transit--brt-station-piece-center","padding":0.5},"left":"transit--brt-station-piece-left-edge","right":"transit--brt-station-piece-right-platform","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.75,"originY":-45,"padding":2}}`<br>`orientation/right` → `{"quirks":{"minWidth":2},"repeat":{"id":"transit--brt-station-piece-center","padding":0.5},"right":"transit--brt-station-piece-right-edge","left":"transit--brt-station-piece-left-platform","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.75,"originY":-45,"padding":2}}`<br>`orientation/center` → `{"quirks":{"minWidth":2},"repeat":{"id":"transit--brt-station-piece-center","padding":0.5},"left":"transit--brt-station-piece-left-platform","right":"transit--brt-station-piece-right-platform","scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.75,"originY":-45,"padding":2}}` |
| `traffic-cone` | `{"name":"Traffic cone","nameKey":"traffic-cone","zIndex":20}` | `type/default` → `{"center":"construction--cone"}` |
| `jersey-barrier` | `{"name":"Jersey barrier","nameKey":"jersey-barrier","zIndex":20}` | `material/concrete` → `{"center":"construction--jersey-barrier-concrete"}`<br>`material/plastic` → `{"center":"construction--jersey-barrier-plastic"}` |
| `barricade` | `{"name":"Barricade","nameKey":"barricade","zIndex":20}` | `type/default` → `{"center":"construction--barricade"}` |
| `open-drain` | `{}` | `drainage-sides/slanted` → `{"quirks":{"minWidth":0.9},"repeat":"utilities--drainage-channel-piece-center","left":"utilities--drainage-channel-piece-left-slanted","right":"utilities--drainage-channel-piece-right-slanted"}`<br>`drainage-sides/vertical` → `{"quirks":{"minWidth":0.5},"repeat":"utilities--drainage-channel-piece-center","left":"utilities--drainage-channel-piece-left-vertical","right":"utilities--drainage-channel-piece-right-vertical"}` |
| `bioswale` | `{}` | `sides/slanted` → `{"quirks":{"minWidth":2.5},"left":"plants--bioswale-pieces-slope-left","right":"plants--bioswale-pieces-slope-right"}`<br>`plants/bush` → `{"scatter":{"sprites":["plants--bush"],"minSpacing":-1,"maxSpacing":1,"padding":1}}`<br>`plants/tree` → `{"scatter":{"sprites":["trees--tree"],"minSpacing":-1,"maxSpacing":1,"padding":1}}` |
| `beach-lounger` | `{}` | `type/default` → `{"center":"beach--lounger"}` |
| `marsh-grass` | `{"name":"Marsh","nameKey":"marsh","owner":"NATURE","zIndex":10}` | `type/default` → `{"scatter":{"sprites":["plants--marsh-grass-01","plants--marsh-grass-02","plants--marsh-grass-03","plants--marsh-grass-04","plants--marsh-grass-05"],"minSpacing":-0.75,"maxSpacing":0.35,"padding":0.25}}` |
| `wall` | `{"name":"Wall","nameKey":"wall","owner":"WALL"}` | `wall-height/low` → `{"quirks":{"minWidth":0.5},"repeat":{"id":"wall--wall-low-center","padding":0.2},"left":{"id":"wall--wall-low-left-sloped","offsetX":0},"right":{"id":"wall--wall-low-right-sloped","offsetX":0}}`<br>`wall-height/high` → `{"quirks":{"minWidth":0.5},"repeat":{"id":"wall--wall-high-center","padding":0.2},"left":{"id":"wall--wall-high-left-sloped","offsetX":0},"right":{"id":"wall--wall-high-right-sloped","offsetX":0}}` |
| `guardrail` | `{"name":"Guard rail","nameKey":"guardrail"}` | `type/default` → `{"center":"dividers--guardrail"}` |

**vehicles** (20)

| id | props | variant leaves → graphics |
|---|---|---|
| `pedestrian` | `{"name":"Pedestrian","nameKey":"pedestrian","owner":"PEDESTRIAN"}` | `density/normal` → `{"scatter":{"pool":"people","minSpacing":0,"maxSpacing":1.5,"padding":0.5}}`<br>`density/dense` → `{"scatter":{"pool":"people","minSpacing":0,"maxSpacing":0.5,"padding":0.5}}`<br>`density/sparse` → `{"scatter":{"pool":"people","minSpacing":1,"maxSpacing":3.5,"padding":0.5}}` |
| `scooter` | `{"name":"Electric scooter","nameKey":"scooter","owner":"BIKE","zIndex":16}` | `direction/inbound` → `{"center":["scooters--scooter-inbound"]}`<br>`direction/outbound` → `{"center":["scooters--scooter-outbound"]}`<br>`riders|orientation/empty/left` → `{"left":"scooters--scooter-left-docked"}`<br>`riders|orientation/empty/right` → `{"right":"scooters--scooter-right-docked"}`<br>`riders|orientation/sparse/left` → `{"left":"scooters--scooter-left-rider"}`<br>`riders|orientation/sparse/right` → `{"right":"scooters--scooter-right-rider"}` |
| `taxi` | `{"name":"Taxi","nameKey":"taxi","owner":"CAR","zIndex":15}` | `direction|orientation/inbound/left` → `{"center":"vehicles--taxi-inbound-door-left"}`<br>`direction|orientation/inbound/right` → `{"center":"vehicles--taxi-inbound-door-right"}`<br>`direction|orientation/outbound/left` → `{"center":"vehicles--taxi-outbound-door-left"}`<br>`direction|orientation/outbound/right` → `{"center":"vehicles--taxi-outbound-door-right"}` |
| `rideshare` | `{"name":"Rideshare","nameKey":"rideshare","owner":"CAR","zIndex":15}` | `direction|orientation/inbound/left` → `{"center":"vehicles--rideshare-inbound-door-left"}`<br>`direction|orientation/inbound/right` → `{"center":"vehicles--rideshare-inbound-door-right"}`<br>`direction|orientation/outbound/left` → `{"center":"vehicles--rideshare-outbound-door-left"}`<br>`direction|orientation/outbound/right` → `{"center":"vehicles--rideshare-outbound-door-right"}` |
| `train` | `{"name":"“Inception” train","nameKey":"inception-train","owner":"TRANSIT","zIndex":10}` | `type/default` → `{"center":"secret--inception-train"}` |
| `bike` | `{"name":"Bike","nameKey":"bike","owner":"BIKE","zIndex":16}` | `type|direction/biker-01/inbound` → `{"center":"bikes--biker-01-inbound"}`<br>`type|direction/biker-01/outbound` → `{"center":"bikes--biker-01-outbound"}`<br>`type|direction/biker-02/inbound` → `{"center":"bikes--biker-02-inbound"}`<br>`type|direction/biker-02/outbound` → `{"center":"bikes--biker-02-outbound"}` |
| `car` | `{"name":"Car","nameKey":"car","owner":"CAR","zIndex":14}` | `direction/inbound` → `{"center":"vehicles--car-inbound"}`<br>`direction/outbound` → `{"center":"vehicles--car-outbound"}`<br>`direction|turn-orientation/inbound/right` → `{"center":"vehicles--car-inbound-turn-signal-right"}`<br>`direction|turn-orientation/inbound/left` → `{"center":"vehicles--car-inbound-turn-signal-left"}`<br>`direction|turn-orientation/outbound/right` → `{"center":"vehicles--car-outbound-turn-signal-right"}`<br>`direction|turn-orientation/outbound/left` → `{"center":"vehicles--car-outbound-turn-signal-left"}`<br>`direction|orientation/inbound/left` → `{"left":"vehicles--car-inbound"}`<br>`direction|orientation/inbound/right` → `{"right":"vehicles--car-inbound"}`<br>`direction|orientation/outbound/left` → `{"left":"vehicles--car-outbound"}`<br>`direction|orientation/outbound/right` → `{"right":"vehicles--car-outbound"}`<br>`direction|orientation/sideways/left` → `{"left":"vehicles--car-sideways-left"}`<br>`direction|orientation/sideways/right` → `{"right":"vehicles--car-sideways-right"}`<br>`direction|orientation/angled-front-left/left` → `{"left":"vehicles--car-angled-front-left"}`<br>`direction|orientation/angled-front-left/right` → `{"right":"vehicles--car-angled-front-left"}`<br>`direction|orientation/angled-front-right/left` → `{"left":"vehicles--car-angled-front-right"}`<br>`direction|orientation/angled-front-right/right` → `{"right":"vehicles--car-angled-front-right"}`<br>`direction|orientation/angled-rear-left/left` → `{"left":"vehicles--car-angled-rear-left"}`<br>`direction|orientation/angled-rear-left/right` → `{"right":"vehicles--car-angled-rear-left"}`<br>`direction|orientation/angled-rear-right/left` → `{"left":"vehicles--car-angled-rear-right"}`<br>`direction|orientation/angled-rear-right/right` → `{"right":"vehicles--car-angled-rear-right"}` |
| `microvan` | `{"name":"Microvan","nameKey":"microvan","owner":"CAR","zIndex":14}` | `direction/inbound` → `{"center":"vehicles--microvan-inbound"}`<br>`direction/outbound` → `{"center":"vehicles--microvan-outbound"}` |
| `av` | `{"name":"Autonomous vehicle","nameKey":"av","owner":"CAR","zIndex":14}` | `direction/inbound` → `{"center":"vehicles--av-inbound"}`<br>`direction/outbound` → `{"center":"vehicles--av-outbound"}` |
| `motorcycle-sidecar` | `{"name":"Motorcycle with sidecar","nameKey":"motorcycle-sidecar","owner":"CAR","zIndex":14}` | `direction/inbound` → `{"center":"vehicles--krz-motorbike-inbound"}`<br>`direction/outbound` → `{"center":"vehicles--krz-motorbike-outbound"}` |
| `truck` | `{"name":"Truck","nameKey":"truck","owner":"CAR","zIndex":14}` | `direction/inbound` → `{"center":"vehicles--truck-inbound"}`<br>`direction/outbound` → `{"center":"vehicles--truck-outbound"}` |
| `food-truck` | `{"name":"Food truck","nameKey":"foodtruck","owner":"CAR","zIndex":20}` | `orientation/left` → `{"center":"vehicles--foodtruck-left"}`<br>`orientation/right` → `{"center":"vehicles--foodtruck-right"}` |
| `streetcar` | `{"name":"Streetcar","nameKey":"streetcar","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--streetcar-inbound"}`<br>`direction/outbound` → `{"center":"transit--streetcar-outbound"}` |
| `light-rail` | `{"name":"Light rail","nameKey":"light-rail","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--light-rail-inbound"}`<br>`direction/outbound` → `{"center":"transit--light-rail-outbound"}` |
| `bus` | `{"name":"Bus","nameKey":"bus","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--bus-inbound"}`<br>`direction/outbound` → `{"center":"transit--bus-outbound"}` |
| `bus-alt` | `{"name":"Bus","nameKey":"bus","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--bus-inbound-alt"}`<br>`direction/outbound` → `{"center":"transit--bus-outbound-alt"}` |
| `brt-bus` | `{"name":"BRT","nameKey":"brt-bus","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--brt-bus-inbound"}`<br>`direction/outbound` → `{"center":"transit--brt-bus-outbound"}` |
| `double-decker-bus` | `{"name":"Double decker bus","nameKey":"double-decker","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--double-decker-bus-inbound"}`<br>`direction/outbound` → `{"center":"transit--double-decker-bus-outbound"}` |
| `av-shuttle` | `{"name":"Autonomous shuttle","nameKey":"av-shuttle","owner":"TRANSIT","zIndex":15}` | `direction/inbound` → `{"center":"transit--av-shuttle-inbound"}`<br>`direction/outbound` → `{"center":"transit--av-shuttle-outbound"}` |
| `magic-carpet` | `{"name":"Magic carpet","nameKey":"magic-carpet","zIndex":14}` | `magic-carpet-occupants/aladdin` → `{"center":{"id":"vehicles--magic-carpet-aladdin","originY":-325}}`<br>`magic-carpet-occupants/jasmine` → `{"center":{"id":"vehicles--magic-carpet-jasmine","originY":-325}}`<br>`magic-carpet-occupants/aladdin-jasmine` → `{"center":{"id":"vehicles--magic-carpet-aladdin-jasmine","originY":-325}}`<br>`magic-carpet-occupants/jasmine-aladdin` → `{"center":{"id":"vehicles--magic-carpet-jasmine-aladdin","originY":-325}}` |

**effects** (1)

| id | props | variant leaves → graphics |
|---|---|---|
| `biker-stress` | `{"name":"Biker stress","nameKey":"biker-stress"}` | `type/sweat-drop` → `{"center":"effects--sweat-drop"}` |


### 1.8 Sprite definition overrides (`sprite_defs.yaml`)

All 35 `markings--*` sprites: `originY: 120`. `lamps--lamp-modern-left/right`: `offsetX: -315`; `lamps--lamp-traditional-left/right`: `offsetX: -45`; `lamps--pride-banner-left/right`: `offsetX: -83, originY: -536`; `effects--sweat-drop`: `originY: -160`; `beach--surface` and `earth--surface`: `offsetY: -12`; `missing: {id: missing}`. `getSpriteDef()` returns `{id}` for any id not listed.

### 1.9 Scatter pool `people` (`client/src/segments/people.yaml`)

42 entries. Default width 0.5 (feet-scale units per README; a few 0.75). Named: `people--people-01` "Nora", `people--people-15` "Lou", `people--people-23` "Katie", `people--johnny-01` "Johnny" (alts `johnny-02`, `disallowFirst`, `weight 5`), `people--junebug-01` "Junebug" (alts, `disallowFirst`, `weight 5`), `people--bernie` "Bernie" (`weight 1`). Entries `people-32..38` carry `alts: [people--people-NN-back]` and some have `tags: [beach]` with `weight: 500`; `client/src/segments/view.ts:836` excludes `beach`-tagged people outside beach contexts (UNVERIFIED exact rule). README default `weight` is 50.

---

## 2. Boundaries (buildings / street edges)

Defined in `packages/parts/data/boundary_defs.yaml`; runtime in `client/src/boundary/` (`boundary.ts` sprite id + height math, `draw.ts` canvas drawing, `constants.ts`: `BOUNDARY_SPACE = 360`, `MAX_BUILDING_FLOORS = 20`; also `MAX_BUILDING_HEIGHT = 20` in `segments/constants.ts`). Picker options and their gating come from `variant_icons.yaml` → `boundary` set (`VariantSet.tsx:43-44`). Street data: `street.boundary.{left,right} = {id, variant, floors, elevation}` (schema ≥32; previous `leftBuildingVariant/Height` fields deprecated). Default `floors` = 1; template default elevation 0.15 m. Floors range 1–20 (`BuildingHeightControl.tsx:138 maxValue={MAX_BUILDING_HEIGHT}`). Height formula for floored items: `(roofHeight + floorHeight*(floors-1) + mainFloorHeight) * TILE_SIZE` px; displayed real height subtracts `CURB_HEIGHT`.

| id | label (i18n) | spriteId | waterfront | hasFloors/showFloors | sameOnBothSides | repeatHalf | alignAtBaseline | offsetY | variantsCount | mainFloor / floor / roof (m) | overhang px | earthColor | picker icon | gating |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `grass` | Grass (Grass) | `boundaries--grass` | — | — | yes | — | — | — | — | — | — | — | grass | — |
| `fence` | Empty lot (Empty lot) | `boundaries--fenced-lot` ±left/right | — | — | — | — | — | — | — | — | — | — | fence | — |
| `parking-lot` | Parking lot (Parking lot) | `boundaries--parking-lot` ±left/right | — | — | — | yes | — | 0.15 | — | — | — | — | car | — |
| `waterfront` | Waterfront (Waterfront) | `boundaries--waterfront` ±left/right | yes | — | — | yes | yes | — | — | — | — | — | waterfront | D:COASTMIX_MODE |
| `waterfront2` | Waterfront (—) | `boundaries--waterfront2` ±left/right | yes | — | — | yes | yes | — | — | — | — | #366387 | waterfront | E:COASTMIX_MODE |
| `residential` | Home (Home) | `buildings--residential` ±left/right | — | yes/yes | — | — | — | — | 0 | 7.25 / 3 / 2 | — | — | residential | — |
| `narrow` | Building (Building) | `buildings--apartments-narrow` ±left/right | — | yes/yes | — | — | — | — | 1 | 4.1 / 3 / 0.7 | 16 | — | building-thin | — |
| `wide` | Building (Building) | `buildings--apartments-wide` ±left/right | — | yes/yes | — | — | — | — | 1 | 4.1 / 3 / 0.7 | 21.5 | — | building-wide | — |
| `arcade` | Arcade building (Arcade building) | `buildings--arcade` ±left/right | — | yes/yes | — | — | — | — | 1 | 4.1 / 3.1 / 1.8 | 15 | — | building-arcade | — |
| `compound-wall` | Compound wall (Compound wall) | `boundaries--compound-wall` ±left/right | — | — | — | — | — | — | — | — | — | — | compound-wall | C:SIGN_IN |
| `beach` | Beach (Beach) | `boundaries--beach` ±left/right | yes | — | — | yes | yes | — | — | — | — | #ecdbb1 | beach [tabler] | E:COASTMIX_MODE |
| `marsh` | Marsh (Marsh) | `boundaries--marsh` ±left/right | yes | — | — | yes | yes | — | — | — | — | — | marsh | E:COASTMIX_MODE |
| `water` | Water (Water) | `boundaries--water` ±left/right | yes | — | — | yes | yes | — | — | — | — | #366387 | water | E:COASTMIX_MODE |
| `dock` | Dock (Dock) | `boundaries--dock` ±left/right | yes | yes/no | — | — | yes | — | 1 | 1.75 / 0.25 / 3 | — | #366387 | dock | E:COASTMIX_MODE |
| `fishing-boat` | Fishing boat (Fishing boat) | `boundaries--fishing-boat` ±left/right | yes | — | — | yes | yes | — | — | — | — | #366387 | fishing-boat | E:COASTMIX_MODE |
| `cargo-ship` | Cargo ship (Cargo ship) | `boundaries--cargo-ship` ±left/right | yes | — | — | — | yes | — | — | — | — | #366387 | cargo-ship | E:COASTMIX_MODE |


Sprites: `boundaries--*-left/right`, `buildings--*-left/right`, `boundaries--grass` (single). English names from i18n `buildings.<id>.name` (narrow and wide both display "Building"). Picker order is YAML order of `variant_icons.yaml` → `boundary`: waterfront, waterfront2, beach, marsh, water, dock, fishing-boat, cargo-ship, grass, fence, parking-lot, residential, narrow, wide, arcade, compound-wall.

---

## 3. Sky / environment / weather (`client/src/sky/`)

Definitions: `client/src/sky/skybox-defs.json`; API `client/src/sky/index.ts` (`getSkyboxDef(id)` falls back to `day`; `getAllSkyboxDefs()` filters `enabled !== false`; gradient → CSS `linear-gradient(...)`, stops `[color, position 0–1]`; canvas stop array filled by interpolation). `DEFAULT_SKYBOX = 'day'` (`constants.ts`). Street data field: `skybox` (renamed from `environment` in schema v29), `weather: 'rain' | 'snow' | null`.

**Premium gating** (`SkyPicker.tsx:15-33`): `isEnabled = isSubscriber || flags.ENVIRONMENTS_UNLOCKED || flags.COASTMIX_MODE`. When not enabled every non-selected option is disabled with a lock icon and a Streetmix+ prompt is shown; there is no per-skybox premium flag — **all skyboxes other than the currently selected one are premium**. Weather section appears only with `WEATHER_EFFECTS`; `Clear` is always selectable, `Rain`/`Snow` follow `isEnabled`.

Clouds: two parallax layers `rear-clouds` (`sky-rear.svg`, speed 0.25) and `front-clouds` (`sky-front.svg`, speed 0.5) in `SkyBox/`; opacity = `cloudOpacity`; CSS keyframe animation only with `SKY_ANIMATED_CLOUDS`. Background objects (`SkyObjects.tsx`) place illustration sprites by fractional `top/left`. `invertUITextColor` toggles `body.dark-skybox-invert-ui`. Weather canvas: `Weather/rain.ts` (ported Caleb Miller rain sim), `Weather/snow.ts` (300 flakes, size ≤2, speed ≤1, `#d9d9d9`).

| id | name | enabled | backgroundColor | backgroundGradient | foregroundGradient | backgroundImage | iconImage | backgroundObjects | cloudOpacity | invertUI | note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `day` (default) | Day | yes | #a9ccdb | — | — | — | — | — | 1 | — |  |
| `twilight` | Twilight | yes | — | `[["#5583be",0],["#eebaa5",0.4],["#de7d8e",0.8]]` | — | — | — | — | 0.85 | — |  |
| `sunset` | Sunset | **no** | — | `[["#020b1a"],["#3e5879"],["#9ba5ae"],["#dcb697"],["#fc7001"],["#dd723c"],["#ad4a28"],["#040308"]]` | — | — | — | — | 0.65 | — |  |
| `dusk` | Dusk | yes | — | `[["#020b1a"],["#3e5879"],["#ec6127",0.5],["#ffbb65",0.7]]` | — | — | — | — | 0.5 | yes |  |
| `sunrise` | Sunrise | **no** | — | `["#a9ccdb","#b7d6fd","#fbce96",["#dd771e",0.9],"#58151a"]` | — | — | — | — | 1 | — | Renamed to 'Dawn' |
| `dawn` | Dawn | yes | — | `["#a9ccdb","#b7d6fd","#fbce96",["#dd771e",0.9],"#58151a"]` | — | — | — | — | 1 | — |  |
| `night` | Night | yes | #000928 | `[["#01051600",0],["#01081777",0.33],["#031641",0.66],["#061c45",1]]` | — | sky--stars | sky--icon-night | `[{"image":"sky--moon","width":116,"height":116,"top":0.2,"left":0.8}]` | 0.2 | yes |  |
| `supermoon` | Night | **no** | #000928 | `[["#01051600",0],["#01081777",0.33],["#031641",0.66],["#061c45",1]]` | — | sky--stars | sky--icon-night | `[{"image":"sky--super-blood-wolf-moon","width":116,"height":116,"top":0.2,"left":0.8}]` | 0.2 | yes |  |
| `karl` | Fog | yes | #e2f0f2 | — | `[["rgba(255,255,255,0.85)",0],["rgba(192,192,192,0.5)",0.85],["transparent",1]]` | — | — | — | 1 | — |  |
| `holodeck` | Holodeck | yes | #141414 | — | — | sky--holodeck-grid | sky--icon-holodeck | — | 0 | yes |  |


i18n keys exist for exactly the 7 enabled ids (`skybox.dawn, day, dusk, holodeck, karl, night, twilight`). Sky sprites in illustrations: `sky--holodeck-grid, sky--icon-holodeck, sky--icon-night, sky--moon, sky--sky-front, sky--sky-rear, sky--stars, sky--super-blood-wolf-moon`. The `public/images/sky-front.{svg,png}` / `sky-rear.*` copies are also loaded by `load_resources.ts`.

---

## 4. Illustrations, icons and images

### 4.1 `packages/illustrations` (`@streetmix/illustrations` v2.2.0, CHANGELOG says v3.0.0 in progress)

- License: **CC-BY-SA-4.0** (`package.json` `license`, full text in `packages/illustrations/LICENSE`, badge + link in `README.md`). No separate ATTRIBUTION file; credits are in `README.md` → "Credits": art direction Katie Lewis; contributors Marcin Wichary, Lou Huang, Doneliza Joaquin, Jon Reese, Brian Wamsley (Hamilton County Planning), Claudio Olivares Medina (AV, magic carpet, BRT), Enrico Ferreguti (arcade buildings).
- Scale: 1 px = 1 cm (README); source files Affinity Designer (`*.afdesign`, e.g. `images/missing.afdesign`, `swatches/`).
- **338 `.svg` files** under `images/`, by directory:

  - `beach`: 2
  - `bikes`: 10
  - `boundaries`: 23
  - `buildings`: 8
  - `construction`: 4
  - `curb`: 4
  - `dividers`: 5
  - `earth`: 1
  - `effects`: 4
  - `furniture`: 5
  - `ground`: 8
  - `lamps`: 10
  - `markings`: 35
  - `(root)`: 1
  - `parklet`: 4
  - `people`: 52
  - `plants`: 15
  - `scooters`: 6
  - `secret`: 1
  - `sky`: 8
  - `thumbnails`: 38
  - `transit`: 28
  - `trees`: 2
  - `utilities`: 7
  - `vehicles/_retired`: 2
  - `vehicles`: 38
  - `vendors`: 4
  - `wall`: 10
  - `wayfinding`: 3

- Includes 38 palette thumbnails (`thumbnails/`), `missing.svg` (placeholder), 2 retired sprites (`vehicles/_retired/fat-car-*`), and several sprites not referenced by any segment (e.g. `dividers--bike-lane-divider`, `effects--electric/exclamation/vein-pop`, `lamps--lamp-traditional-with-base-wyc`, `lamps--lamp-traditional-both`, `parklet--yerba-buena-parklet-left/right` (v01), `plants--marsh-grass-06`, `transit--brt-station-left/right/center`, `transit--tracks-dark/light`, `wall--*-straight`, `people--*` are pooled).
- Full sprite id list is in `catalog.json → illustrationSpriteIds`.

### 4.2 Sprite build (`app/lib/svg_sprite.ts`)

`compileSVGSprites(source, filename, namespace)` globs `source/**/*.svg`, wraps each in a Vinyl file so subdirectory paths survive, feeds `svg-sprite` in `symbol` mode (inline, single file) with id generator `` `${namespace}-%s` ``, and writes `build/<filename>.svg`. Called from `app.ts:37-38`:
`compileSVGSprites('packages/variant-icons/icons/', 'icons', 'icon')` → `/assets/icons.svg` (symbols `icon-<name>`) and
`compileSVGSprites('packages/illustrations/images/', 'images', 'image')` → `/assets/images.svg` (symbols `image-<dir>--<file>`).
The client (`client/src/app/load_resources.ts`) fetches both, injects into `#svg`, strips the `image-` prefix and caches each `<symbol>` as an `<img>` data-URI for canvas drawing; `icon-*` symbols are skipped from the cache.

### 4.3 `packages/variant-icons` (`@streetmix/variant-icons` v1.0.0)

- License **CC-BY-SA-4.0** (`package.json`; no LICENSE file in the package; README links docs and the archived `streetmix/icons` repo). Source: `src/icons.afdesign`.
- **84 SVGs** in `icons/` (flat). Ids listed in `catalog.json → variantIconIds`. Some variant buttons use Tabler icons instead (`iconSet: tabler`: `beach`, `beach-off`), and UI icons come from Tabler + Font Awesome (About dialog credits; FA link titled "CC BY-SA 4.0" — FA Free icons are actually CC BY 4.0, UNVERIFIED which applies).

### 4.4 `client/images` and `public/images`

| Path | Contents | License |
|---|---|---|
| `client/images/logo_main.svg`, `logo_horizontal.svg`, `wordmark_{black,green,white}.svg`, `wm-icon-animated.svg`, `waves-left/right.svg`, `warning_alert.svg`, `warning_error.svg` | Streetmix logos/wordmarks and UI warning glyphs | No license stated for brand assets (repo code is AGPL-3.0-or-later per root `LICENSE`; originally BSD-3) — **UNVERIFIED** whether logos are covered |
| `client/images/openmoji/color/*.svg` (8: 1F326, 1F604, 1F60A, 1F60D, 1F610, 1F620, 1F641, 2600) + `LICENSE.txt` | OpenMoji emoji for sentiment survey | **CC BY-SA 4.0** (`openmoji/LICENSE.txt`; credited in About dialog) |
| `client/images/sponsors/` | `bif.svg, codeforamerica.png, lyft.svg, mozilla.svg, numo.svg` | Third-party logos, no license stated |
| `public/images/` | `logo.svg`, `wordmark*.svg`, `avatar.svg`, Leaflet `marker-icon*.png`/`marker-shadow.png`, `sky-front/rear.{svg,png}`, `thumbnail.png`, `thumbnail-coastmix.png` | none stated (Leaflet markers are BSD-2 upstream, UNVERIFIED) |
| `public/images/descriptions/` (23 jpg) | "Learn more" photos: bike-lane-01/02, bike-lane-colored-01, bike-lane, bioswale-01/02, bus-lane, dedicated-brt-lane, drive-lane, marsh-01, parking-lane, parklets-01, planting-strip, sharrow-01, sidewalk(-brick,-trees,2), train, transit-station-elevated, turn-lane, wayfinding-01/02 | Per-image credits only via `imageCredit`/`imageCaption` (e.g. SF Planning Dept, Lou Huang, City of Boston, Mass. DCR); no license file |
| `public/images/changelog/` (21) | What's New screenshots | none stated |
| `public/images/team/` (12 jpg) | team portraits | none stated |

---

## 5. Street templates

Files: `app/data/templates/*.yaml`, served statically at `/assets/data/templates/<id>.yaml` (`app.ts:334`). Loaded client-side by `client/src/streets/templates.ts` → `prepareStreet(id)`: fetch → `js-yaml` → Zod `StreetTemplate` strict schema → `createStreetData()`. Template ids are enumerated in `client/src/app/constants.ts` `STREET_TEMPLATES` (`default, empty, copy, harborwalk*, coastal_road*, beach*, stroad, empty_waterfront`; `*` = "Deprecated" comment). There is no `client/src/streets/*template*` other than `templates.ts`/`templates.test.ts`.

Zod schema: `width: number | {metric, imperial}`; `showAnalytics?`; `boundary.left/right: {variant, floors=1, elevation=0.15}`; `slices[]: {type, variant: Record<dim,value>, width, elevation?, label?, slope?: {on?, values[]}}`. Processing rules: bare-number widths are metric; in imperial mode they are multiplied by `ROUGH_CONVERSION_RATE = (10/3)*0.3048` (so `2.7` → 9 ft → 2.743 m) and normalized to the imperial resolution; `{metric, imperial}` objects use the matching value (imperial converted ×0.3048). Left-hand-traffic locales mirror the slice order and swap `left`/`right` in any variant key containing `orientation`. `variantString` is derived by joining variant values. Elevation falls back to the variant's lane elevation. Street gets `schemaVersion: 35`, `skybox: 'day'`, `weather: null`, `showAnalytics: true` unless overridden, `units` from settings.


#### `beach` — #############################################################################

- File: `app/data/templates/beach.yaml`; Beach Coastal condition where a beach area abuts a body of water. #############################################################################
- UI: Not in menu; marked Deprecated in client/src/app/constants.ts
- Width: 24 (bare → metric; imperial ×(10/3) ft); showAnalytics: false
- Boundary left: `{"variant":"grass","floors":1,"elevation":{"metric":0.15,"imperial":0.5}}`; right: `{"variant":"water","floors":1,"elevation":0}`
- Slices (5):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|
| 1 | `sidewalk` | `sidewalk-density=normal` | 6 / 20 | 0.15 / 0.5 | — | Pedestrian walk |
| 2 | `marsh` | `marsh-type=marsh` | 5 / 17 | 0 | `[0,{"metric":0.3,"imperial":1}]` | Dune |
| 3 | `marsh` | `marsh-type=marsh` | 0.5 / 2 | 0.3 / 1 | — | Dune |
| 4 | `marsh` | `marsh-type=marsh` | 2 / 6 | 0 | `[{"metric":0.3,"imperial":1},0]` | Dune |
| 5 | `beach` | `beach-type=lounger` | 10.5 / 35 | 0 | — | — |

#### `coastal_road` — #############################################################################

- File: `app/data/templates/coastal_road.yaml`; Coastal road Coastal condition where an existing vehicular road is separated from a body of water by a vegetated area. #############################################################################
- UI: Not in menu; marked Deprecated in client/src/app/constants.ts
- Width: 19.5 / 64 (m / ft); showAnalytics: false
- Boundary left: `{"variant":"wide","floors":4,"elevation":{"metric":0.15,"imperial":0.5}}`; right: `{"variant":"waterfront2","floors":1,"elevation":0}`
- Slices (11):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|
| 1 | `sidewalk` | `sidewalk-density=normal` | 1.9 / 6 | 0.15 / 0.5 | — | — |
| 2 | `sidewalk-tree` | `tree-type=big` | 0.3 / 1 | (variant default) | — | — |
| 3 | `sidewalk-lamp` | `lamp-orientation=right, lamp-type=modern` | 0.6 | (variant default) | — | — |
| 4 | `brt-lane` | `direction=inbound, brt-asphalt=regular` | 3.6 | (variant default) | — | — |
| 5 | `drive-lane` | `direction=inbound, car-type=car` | 2.7 / 9 | (variant default) | — | — |
| 6 | `drive-lane` | `direction=outbound, car-type=car` | 2.7 / 9 | (variant default) | — | — |
| 7 | `parking-lane` | `parking-lane-direction=outbound, parking-lane-orientation=right` | 2.3 / 8 | (variant default) | — | — |
| 8 | `bike-lane` | `bike-direction=outbound, bike-asphalt=green, elevation=road` | 2 / 6 | (variant default) | — | — |
| 9 | `sidewalk-lamp` | `lamp-orientation=left, lamp-type=modern` | 0.6 | (variant default) | — | — |
| 10 | `sidewalk-tree` | `tree-type=big` | 0.3 / 1 | (variant default) | — | — |
| 11 | `sidewalk` | `sidewalk-density=dense` | 2.5 / 8 | (variant default) | — | — |

#### `default` — #############################################################################

- File: `app/data/templates/default.yaml`; Default street The "default street" was designed to be a pretty "good" street as well as a showcase of Streetmix features. It has changed over time, and can continue to do so. #############################################################################
- UI: New Street menu: 'New example street' (always; also the street created for first-time visitors via makeDefaultStreet)
- Width: 24 (bare → metric; imperial ×(10/3) ft); showAnalytics: true
- Boundary left: `{"variant":"narrow","floors":4,"elevation":{"metric":0.15,"imperial":0.5}}`; right: `{"variant":"wide","floors":3,"elevation":{"metric":0.15,"imperial":0.5}}`
- Slices (14):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|
| 1 | `sidewalk` | `sidewalk-density=dense` | 1.8 | (variant default) | — | — |
| 2 | `sidewalk-tree` | `tree-type=big` | 0.6 | (variant default) | — | — |
| 3 | `transit-shelter` | `orientation=left, transit-shelter-elevation=street-level` | 2.7 | (variant default) | — | — |
| 4 | `sidewalk-lamp` | `lamp-orientation=right, lamp-type=modern` | 0.6 | (variant default) | — | — |
| 5 | `bus-lane` | `direction=inbound, bus-asphalt=shared, bus-type=typical` | 3.6 | (variant default) | — | — |
| 6 | `drive-lane` | `direction=inbound, car-type=car` | 2.7 | (variant default) | — | — |
| 7 | `divider` | `divider-type=bush` | 0.9 | (variant default) | — | — |
| 8 | `turn-lane` | `direction=outbound, turn-lane-orientation=left-straight` | 3 | (variant default) | — | — |
| 9 | `parking-lane` | `parking-lane-direction=outbound, parking-lane-orientation=right` | 2.1 | (variant default) | — | — |
| 10 | `divider` | `divider-type=planter-box` | 1.2 | (variant default) | — | — |
| 11 | `bike-lane` | `bike-direction=outbound, bike-asphalt=green, elevation=road` | 1.8 | (variant default) | — | — |
| 12 | `sidewalk-lamp` | `lamp-orientation=left, lamp-type=modern` | 0.6 | (variant default) | — | — |
| 13 | `sidewalk-tree` | `tree-type=big` | 0.6 | (variant default) | — | — |
| 14 | `sidewalk` | `sidewalk-density=normal` | 1.8 | (variant default) | — | — |

#### `empty` — #############################################################################

- File: `app/data/templates/empty.yaml`; Empty street The "empty street" is like a blank slate. It has no slices (or lanes) and only have plain grass on either side. #############################################################################
- UI: New Street menu: 'New empty street' (always)
- Width: 24 (bare → metric; imperial ×(10/3) ft); showAnalytics: true
- Boundary left: `{"variant":"grass","floors":1,"elevation":{"metric":0.15,"imperial":0.5}}`; right: `{"variant":"grass","floors":1,"elevation":{"metric":0.15,"imperial":0.5}}`
- Slices (0):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|

#### `empty_waterfront` — #############################################################################

- File: `app/data/templates/empty_waterfront.yaml`; Empty waterfront The "empty waterfront" is a blank slate but for Coastmix.. It has no slices (or lanes) and starts with regular water on both sides. #############################################################################
- UI: New Street menu: 'New empty waterfront' when flag COASTMIX_MODE
- Width: 24 (bare → metric; imperial ×(10/3) ft); showAnalytics: true
- Boundary left: `{"variant":"waterfront2","floors":1,"elevation":0}`; right: `{"variant":"waterfront2","floors":1,"elevation":0}`
- Slices (0):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|

#### `harborwalk` — #############################################################################

- File: `app/data/templates/harborwalk.yaml`; Harborwalk Coastal condition where a public pedestrian zone is on or adjacent to a a seawall abutting a body of water. #############################################################################
- UI: Not in menu; STREET_TEMPLATES.HARBORWALK marked Deprecated in client/src/app/constants.ts (reachable via /new?type=harborwalk UNVERIFIED)
- Width: 24 (bare → metric; imperial ×(10/3) ft); showAnalytics: false
- Boundary left: `{"variant":"fence","elevation":{"metric":0.5,"imperial":1.5}}`; right: `{"variant":"dock","floors":1,"elevation":0}`
- Slices (8):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|
| 1 | `divider` | `divider-type=big-tree` | 1 / 3 | 0.3 / 1 | — | Park |
| 2 | `divider` | `divider-type=flowers` | 4 / 14 | 0.3 / 1 | — | Park |
| 3 | `divider` | `divider-type=big-tree` | 1 / 3 | 0.3 / 1 | — | Park |
| 4 | `bike-lane` | `bike-direction=twoway-right, bike-asphalt=regular, elevation=sidewalk` | 3 / 10 | 0.15 / 0.5 | — | Cycletrack |
| 5 | `sidewalk-lamp` | `lamp-orientation=left, lamp-type=traditional` | 0.5 / 2 | 0.3 / 1 | — | — |
| 6 | `divider` | `divider-type=big-tree` | 2.5 / 8 | 0.3 / 1 | — | Park |
| 7 | `divider` | `divider-type=planting-strip` | 8 / 26 | 0 | `[{"metric":0.3,"imperial":1},0]` | Berm |
| 8 | `sidewalk` | `sidewalk-density=normal` | 4 / 14 | 0 | — | Harborwalk |

#### `stroad` — #############################################################################

- File: `app/data/templates/stroad.yaml`; U.S. Stroad Local arterial boulevards built to federal highway standards and just as dangerous and uninspiring for good city planning. #############################################################################
- UI: New Street menu: 'Street templates > Stroad' when flag NEW_STREET_TEMPLATES (default true) and not COASTMIX_MODE; disabled unless signed in
- Width: 30 / 100 (m / ft); showAnalytics: true
- Boundary left: `{"variant":"parking-lot","floors":1,"elevation":{"metric":0.15,"imperial":0.5}}`; right: `{"variant":"parking-lot","floors":1,"elevation":{"metric":0.15,"imperial":0.5}}`
- Slices (11):

| # | type | variant | width | elevation | slope | label |
|---|---|---|---|---|---|---|
| 1 | `sidewalk` | `sidewalk-density=empty` | 1.2 / 4 | 0.15 / 0.5 | — | — |
| 2 | `sidewalk-lamp` | `lamp-orientation=right, lamp-type=modern` | 0.3 / 1 | 0.15 / 0.5 | — | — |
| 3 | `parking-lane` | `parking-lane-direction=inbound, parking-lane-orientation=left` | 3.5 / 12 | (variant default) | — | — |
| 4 | `drive-lane` | `direction=inbound, car-type=car` | 4 / 13 | (variant default) | — | — |
| 5 | `drive-lane` | `direction=inbound, car-type=car` | 4 / 13 | (variant default) | — | — |
| 6 | `turn-lane` | `direction=outbound, turn-lane-orientation=shared` | 4 / 14 | (variant default) | — | — |
| 7 | `drive-lane` | `direction=outbound, car-type=car` | 4 / 13 | (variant default) | — | — |
| 8 | `drive-lane` | `direction=outbound, car-type=car` | 4 / 13 | (variant default) | — | — |
| 9 | `parking-lane` | `parking-lane-direction=outbound, parking-lane-orientation=right` | 3.5 / 12 | (variant default) | — | — |
| 10 | `utilities` | `orientation=left` | 0.3 / 1 | 0.15 / 0.5 | — | — |
| 11 | `sidewalk` | `sidewalk-density=normal` | 1.2 / 4 | 0.15 / 0.5 | — | — |


---

## 6. Default street, units, widths, schema

### 6.1 Default street for new users
`client/src/streets/creation.ts` `makeDefaultStreet()` → `prepareStreet('default')` → `app/data/templates/default.yaml` (24 m street, narrow 4-floor building left / wide 3-floor right, 14 slices: sidewalk(dense) 1.8, tree 0.6, transit shelter 2.7, lamp 0.6, shared bus/bike lane 3.6, drive lane inbound 2.7, bush divider 0.9, turn lane left-straight 3, parking outbound 2.1, planter box 1.2, green bike lane 1.8, lamp 0.6, tree 0.6, sidewalk(normal) 1.8 — sums to 24.0 m). The "empty" template is `onNewStreetEmptyClick()`. `createNewStreetOnServer(type = 'default')` in `streets/xhr.ts`. Comments in `creation.ts` call these "deprecated".

### 6.2 Storage units and schema
- **All measurements are stored in meters** since schema v30 (`app/lib/street_schema_update.js` case 29: streets with legacy `units === 2` metric were converted with the imprecise 0.3 factor; imperial with 0.3048; `units` values collapsed to `0 = metric`, `1 = imperial`). `SETTINGS_UNITS_METRIC = 0`, `SETTINGS_UNITS_IMPERIAL = 1` (`client/src/users/constants.ts`).
- Elevations converted to meters in v33 (abstract `1` → 0.15 m or 6" = 0.152 m; `2` → 0.75 m or 2.5' = 0.762 m; drainage `-2` → 0). v34 added `slope: {on:false, values:[]}` to every slice. v35 ensures `location` is `null` when absent. `LATEST_SCHEMA_VERSION = 35` (both `app/lib/street_schema_update.js:10` and `client/src/streets/templates.ts:35`).
- `MeasurementValues = {metric: number /*m*/, imperial: number /*ft*/}` is the pattern used in all definitions; `getWidthInMetric(mv, units)` returns `mv.metric` for metric users or `round(mv.imperial*0.3048, 3)` for imperial users — so imperial users get "round feet" values stored as odd meters (e.g. drive lane 10 ft → 3.048 m rather than 3 m).

### 6.3 Exact constants


**`client/src/segments/constants.ts`**

| constant | value |
|---|---|
| `TILESET_POINT_PER_PIXEL` | 2.0 * 1.27 (=2.54; 1 inch to 1 cm conversion) |
| `TILE_SIZE` | 12 / 0.3048 (=39.37 px per meter; '24px per foot' legacy scale) |
| `TILE_SIZE_ACTUAL` | TILE_SIZE * TILESET_POINT_PER_PIXEL |
| `MIN_SEGMENT_WIDTH` | 0.25 m |
| `MAX_SEGMENT_WIDTH` | 120 m |
| `MIN_ELEVATION` | 0 |
| `MAX_ELEVATION_METRIC` | 5 m |
| `MAX_ELEVATION_IMPERIAL` | 4.8768 m (16 ft) |
| `SEGMENT_WIDTH_RESOLUTION_IMPERIAL` | 0.25 ft = 0.0762 m |
| `SEGMENT_WIDTH_CLICK_INCREMENT_IMPERIAL` | 0.5 ft = 0.1524 m |
| `SEGMENT_WIDTH_DRAGGING_RESOLUTION_IMPERIAL` | 0.5 ft = 0.1524 m |
| `SEGMENT_WIDTH_RESOLUTION_METRIC` | 0.05 m |
| `SEGMENT_WIDTH_CLICK_INCREMENT_METRIC` | 0.1 m |
| `SEGMENT_WIDTH_DRAGGING_RESOLUTION_METRIC` | 0.1 m |
| `BOUNDARY_WIDTH` | 360 px |
| `MAX_BUILDING_HEIGHT` | 20 floors |
| `MAX_CANVAS_HEIGHT` | 2048 px |
| `CANVAS_HEIGHT` | 600 px |
| `GROUND_BASELINE_HEIGHT` | 45 px |
| `ELEVATION_INCREMENT` | 0.15 m |
| `ELEVATION_INCREMENT_IMPERIAL` | 0.5 ft = 0.1524 m |
| `CURB_HEIGHT` | 0.15 m |
| `CURB_HEIGHT_IMPERIAL` | 0.1524 m |
| `DRAGGING_MOVE_HOLE_WIDTH` | 40 px |

**`client/src/streets/constants.ts`**

| constant | value |
|---|---|
| `MIN_CUSTOM_STREET_WIDTH` | 3 m |
| `MAX_CUSTOM_STREET_WIDTH` | 120 m |
| `MIN_CUSTOM_STREET_WIDTH_IMPERIAL` | 10 ft = 3.048 m |
| `MAX_CUSTOM_STREET_WIDTH_IMPERIAL` | 400 ft = 121.92 m |
| `DEFAULT_CAPACITY_SOURCE` | giz |

**`client/src/users/constants.ts`**

| constant | value |
|---|---|
| `SETTINGS_UNITS_METRIC` | 0 |
| `SETTINGS_UNITS_IMPERIAL` | 1 |

**`client/src/util/width_units.ts`**

| constant | value |
|---|---|
| `IMPERIAL_CONVERSION_RATE` | 0.3048 |
| `METRIC_PRECISION` | 3 |
| `IMPERIAL_PRECISION` | 3 |
| `WIDTH_INPUT_CONVERSION` | m, м, dm(1/10), cm(1/100), mm(1/1000), " ″ in in. inch inches (0.3048/12), ' ′ ft ft. feet (0.3048) |
| `IMPERIAL_VULGAR_FRACTIONS` | ⅛ ¼ ⅜ ½ ⅝ ¾ ⅞ |

**`packages/utils/src/dimensions.ts`**

| constant | value |
|---|---|
| `IMPERIAL_CONVERSION_RATE` | 0.3048 |
| `IMPERIAL_PRECISION` | 3 |
| `METRIC_PRECISION` | 3 |
| `roundToNearestEighth` | Math.round(v*8)/8 applied to imperial display |
| `prettifyWidth` | metric: '3 m' (ru: ' м', ar: ' م'); imperial: feet with vulgar fractions + prime '′' |

**`client/src/streets/templates.ts`**

| constant | value |
|---|---|
| `ROUGH_CONVERSION_RATE` | (10/3)*0.3048 = 1.016 (used when a template gives a bare number and the user is in imperial: m*10/3 ft) |
| `LATEST_SCHEMA_VERSION` | 35 |

**`app/lib/street_schema_update.js`**

| constant | value |
|---|---|
| `LATEST_SCHEMA_VERSION` | 35 |

**`client/src/boundary/constants.ts`**

| constant | value |
|---|---|
| `BOUNDARY_SPACE` | 360 |
| `MAX_BUILDING_FLOORS` | 20 |

**`client/src/sky/constants.ts`**

| constant | value |
|---|---|
| `DEFAULT_SKYBOX` | day |

**`client/src/sky/SkyBox/SkyBox.tsx`**

| constant | value |
|---|---|
| `REAR_CLOUD_PARALLAX_SPEED` | 0.25 |
| `FRONT_CLOUD_PARALLAX_SPEED` | 0.5 |

**`client/src/sky/Weather/snow.ts`**

| constant | value |
|---|---|
| `NUMBER_OF_SNOWFLAKES` | 300 |
| `MAX_SNOWFLAKE_SIZE` | 2 |
| `MAX_SNOWFLAKE_SPEED` | 1 |
| `SNOWFLAKE_COLOR` | #d9d9d9 |

**`client/src/segments/slope.ts`**

| constant | value |
|---|---|
| `slopeExceededBerm` | ratio (run/rise) < 3  (3H:1V) |
| `slopeExceededPath` | ratio < 20 (5%, ADA 1V:20H) |

**`client/src/streets/width.ts`**

| constant | value |
|---|---|
| `remainingWidthZeroThreshold` | abs(remaining) < 0.01 -> 0 |


### 6.4 Width normalisation and formatting
- `normalizeSegmentWidth(width, resolution)` clamps to `[0.25, 120]` m, rounds to `resolution` multiples, then `round(…, 3)` (`client/src/segments/resizing.ts`). Resolution by action (`resolutionForResizeType`): INITIAL/TYPING/PRECISE_DRAGGING → 0.05 m or 0.25 ft; INCREMENT (click ±) → 0.1 m or 0.5 ft; DRAGGING → 0.1 m or 0.5 ft.
- `normalizeHeightValue` clamps elevation to `[0, 5 m]` metric or `[0, 4.8768 m]` imperial, rounded to resolution and 3 decimals.
- `normalizeStreetWidth` (`client/src/streets/width.ts`) clamps to 3–120 m (metric) or 10–400 ft (imperial), rounds to width resolution, 3 decimals (decimal.js). Occupied/remaining width computed with decimal.js; |remaining| < 0.01 → 0.
- Display (`packages/utils/src/dimensions.ts`): metric → up to 3 decimals + " m" (ru " м", ar " م", Arabic forces Latin digits); imperial → `round(m/0.3048, 3)` → nearest ⅛ → vulgar fractions ⅛¼⅜½⅝¾⅞ + prime `′` (e.g. 0.914 m → "3′", 1.113 m → "3⅝′").
- Input parsing (`client/src/util/width_units.ts`): strips spaces, comma→dot, vulgar fractions→decimal, supports `5'6"` feet-inches, unit suffixes m/м/dm/cm/mm/in/"/″/inch(es)/ft/'/′/feet; unitless input is meters (metric) or feet (imperial); result rounded to 3 decimals.
- Warnings (`client/src/streets/warnings.ts`): `outOfBounds`, `tooNarrow` (< variant `minWidth` in user units), `tooWide` (> `maxWidth`), `dangerousExisting` (variant `dangerous:true` — only `drive-lane` `car-with-bike`), `slopeBermExceeded` (run:rise < 3), `slopePathExceeded` (< 20, i.e. >5 %). Capacity drops to 0 for `outOfBounds`, `tooNarrow`, `slopePathExceeded`.

---

## 7. Analytics / capacity (`client/src/segments/capacity.ts`, `capacity_data.json`)

- Data file: `client/src/segments/capacity_data.json` (no copy in `app/data` or `packages/parts`). Units: **people per hour per lane** (implied by sources; not stated in file — UNVERIFIED). Each source has `id`, `source_title`, `source_author`, `source_url`, `typical_lane_width {metric, imperial}` (an assumption statement, not used in math), and `segments`.
- Processing: every source inherits `common` segments (`magic-carpet: {average 2, potential 3}`); `inherits` replaces a segment/variant with another segment's values (`scooter` ← `bike-lane`, `streetcar` ← `light-rail`, `drive-lane[car-type:pedestrian]` ← `sidewalk`). Variant overrides are keyed `"<dim>:<value>"` and matched against the slice's `variant` object (so two-way bike lanes double). `average = average ?? minimum ?? 0`; `potential = potential ?? average ?? 0` ("Temporary" mappings per code comments). Street total = sum over slices; rollup groups by type and sorts ascending by average then potential; CSV export via PapaParse (`<streetName>_capacity.csv`, columns type/averageCapacity/potentialCapacity).
- Default source: `DEFAULT_CAPACITY_SOURCE = 'giz'` (`client/src/streets/constants.ts`); street may store `capacitySource`. A `'none'` source is mentioned in the comment but **not** implemented in `processCapacityData` (UNVERIFIED handling elsewhere).
- Capacity is defined only for: `sidewalk, drive-lane, bike-lane, scooter, light-rail, streetcar, bus-lane, brt-lane, magic-carpet`; all other types return `undefined` (excluded from chart).

| segment / variant | giz avg / potential | nacto avg / potential (raw) | vancouver avg / potential (raw) |
|---|---|---|---|
| `sidewalk` | 15000 / 15000 | 9000 / 9000 | 5500 / 6500 (min 5000, avg 5500, pot 6500) |
| `scooter` | 12000 / 12000 | 3750 / 3750 | 2000 / 3000 (min 2000, pot 3000) |
| &nbsp;&nbsp;↳ `bike-direction:twoway-left` | 24000 / 24000 | 7500 / 7500 | 4000 / 6000 (min 4000, pot 6000) |
| &nbsp;&nbsp;↳ `bike-direction:twoway-right` | 24000 / 24000 | 7500 / 7500 | 4000 / 6000 (min 4000, pot 6000) |
| `bike-lane` | 12000 / 12000 | 3750 / 3750 | 2000 / 3000 (min 2000, pot 3000) |
| &nbsp;&nbsp;↳ `bike-direction:twoway-left` | 24000 / 24000 | 7500 / 7500 | 4000 / 6000 (min 4000, pot 6000) |
| &nbsp;&nbsp;↳ `bike-direction:twoway-right` | 24000 / 24000 | 7500 / 7500 | 4000 / 6000 (min 4000, pot 6000) |
| `drive-lane` | 1500 / 2000 | 600 / 1600 (min 600, pot 1600) | 850 / 1000 (min 700, avg 850, pot 1000) |
| &nbsp;&nbsp;↳ `car-type:pedestrian` | 15000 / 15000 | 9000 / 9000 | 5500 / 6500 (min 5000, avg 5500, pot 6500) |
| `bus-lane` | 5000 / 8000 | 1000 / 2800 (min 1000, pot 2800) | 1700 / 2000 (min 1000, avg 1700, pot 2000) |
| `streetcar` | 18000 / 20000 | 10000 / 25000 | 2000 / 2500 (min 2000, pot 2500) |
| `light-rail` | 18000 / 20000 | 10000 / 25000 | 2000 / 2500 (min 2000, pot 2500) |
| `brt-lane` | 14000 / 24000 | 4000 / 8000 (min 4000, pot 8000) | 3500 / 4000 (min 3000, avg 3500, pot 4000) |
| `magic-carpet` | 2 / 3 | 2 / 3 | 2 / 3 |

Sources: giz = TUMI/GIZ "Passenger capacity of different transport modes" (https://www.transformative-mobility.org/publications/passenger-capacity-of-different-transport-modes); nacto = NACTO Transit Street Design Guide 2016 (https://nacto.org/publication/transit-street-design-guide/introduction/why/designing-move-people/); vancouver = City of Vancouver 2017 (https://twitter.com/BrentToderian/status/953085021744611328). `common` source: magic-carpet 2/3 only.


Stated assumptions: GIZ/TUMI "Passenger capacity of different transport modes" (typical lane 3.5 m / 11.5 ft); NACTO Transit Street Design Guide 2016 "Designing to Move People" (3 m / 10 ft lane; `minimum`+`potential` pairs); City of Vancouver 2017 "People Moving Capacity" via Brent Toderian tweet (3 m / 10 ft; min/avg/potential). None of the sources account for slice width, adjacency or direction beyond the two-way bike lane doubling.

---

## 8. Documentation cross-check (`docs/docs/user-guide/`)

### 8.1 `segments.md`
Stub only (`unlisted: true`): "This page has moved. Please see Street design elements."

### 8.2 `vehicles.md` ("Under construction")
Lists vehicles; cross-check against `components.yaml → vehicles` and `segment-lookup.yaml`:

| Doc item | Exists in source? | Where |
|---|---|---|
| Personal automobile | yes | vehicle `car`; `drive-lane` `car-type: car`, `turn-lane`, `parking-lane` |
| Taxi | yes | vehicle `taxi`; `flex-zone` `flex-type: taxi` |
| Rideshare | yes | vehicle `rideshare`; `flex-zone` `flex-type: rideshare` |
| Autonomous vehicle | yes | vehicle `av`; `drive-lane` `car-type: av` (SIGN_IN) |
| Bicycle | yes | vehicle `bike` (biker-01/02); `bike-lane`, sharrow, mixed lanes |
| Motorcycle (with sidecar) | yes | vehicle `motorcycle-sidecar` (`vehicles--krz-motorbike-*`); `drive-lane` (SIGN_IN) |
| Truck | yes | vehicle `truck`; `drive-lane` |
| Food truck | yes | vehicle `food-truck`; segment `food-truck` |
| Streetcar | yes | vehicle `streetcar`; segment `streetcar` |
| Light rail | yes | vehicle `light-rail`; segment `light-rail` |
| Bus | yes | vehicles `bus`, `bus-alt`; `bus-lane`, `drive-lane car-with-bus` |
| Electric scooter | yes | vehicle `scooter`; segments `scooter`, `scooter-drop-zone` |
| Magic carpet | yes | vehicle `magic-carpet`; segment `magic-carpet` (SIGN_IN) |
| *Not in doc but in source* | — | `microvan` (SUBSCRIBE), `brt-bus` (`brt-lane`), `double-decker-bus` (SUBSCRIBE), `av-shuttle` (SUBSCRIBE), `train` ("Inception", flag), `pedestrian` density/scatter (doc explicitly says pedestrians are not vehicles; source models them as a `vehicles` component) |

### 8.3 `street-design-elements.md` ("Under construction") vs `segment-lookup.yaml`

| Doc element | Doc values | Source values | Match? |
|---|---|---|---|
| Typical drive lane | default 10 ft/3.0 m; min 9 ft/2.7 m; max 12 ft/3.6 m | `drive-lane` default 3 m/10 ft; **min 2.4 m/8 ft**; max 3.6 m/12 ft | default/max match; **min differs** (doc 9 ft, source 8 ft) |
| Typical turn lanes | default 10; min 10; max "12 ft (4.8m)" (typo) | `turn-lane` default 3 m/10 ft; **min 2.7 m/9 ft**; max 3.6 m/12 ft | **min differs** |
| Center turn lane | default 12/3.6; min 10/3.0; max 16/4.8 | `turn-lane` `shared` variant: default 3.6/12, min 3/10, max 4.8/16 | match |
| Parallel parking | default 8 ft; min 7; max 10 | `parking-lane` **default 2 m/7 ft**; min 2.1 m/7 ft; max 3 m/10 ft | **default differs** (7 vs 8 ft); note metric default 2.0 < metric min 2.1 → fresh metric parking lane triggers `tooNarrow` |
| Perpendicular parking | default 18–20; min 14–18; max 22 | `sideways` variants: min 4.2 m/14 ft, max 6 m/20 ft, **no defaultWidth override** (inherits 2 m/7 ft) | partial; switching variant leaves width below min |
| Angled parking | narrower than perpendicular | `angled-*` variants: min 4.2/14, max 5.4/18 | consistent |
| Typical bike lane | default 6 ft; min 3 ft; max 8 ft | `bike-lane` default 1.8/6; **min 1.5/5**; **no max** | default matches; min/max differ |
| Sharrow | default 14/4.2; min 12/3.6; max 14/4.2 | `drive-lane` `sharrow`: default 4.2/14, min 3.6/12, max 4.2/14 | match |
| Cycletrack two-way | min 3 m/10 ft | `twoway-left/right`: minWidth 3 m/10 ft | match |
| Painted buffer | 2 ft min, "not currently automatic" | `divider` `striped-buffer` default 0.5 m/2 ft, no minWidth | exists as separate segment |
| Medians (divider) | curb only, planted | `divider` `median`, `planting-strip`, `bush`, `flowers`, `big-tree`, `palm-tree`, `planter-box`, `bollard`, `dome` | exists |
| Pedestrian median | ≥6 ft | no distinct type | not present |
| Shoulders and gutters | "not presently planned" | none | consistent (closest: `drainage-channel`) |
| Streetcars/light rail | default 10 ft; min 10; max none | `streetcar`/`light-rail`: **default 3.6 m/12 ft**; min 3/10; **max 4.2/14** | default/max differ |
| Buses / Trains | empty headings | `bus-lane` 3.6/12 (min 3/10, max 3.9/13), `brt-lane` 3.5/11.667 (min 3.4/11.5, max 4/13), `train` 4.2/14 | undocumented |
| Sidewalk | 8 ft min incl. buffer; residential 4–8 ft | `sidewalk` default 1.8/6, min 1.8/6 | differs |
| Sidewalk border / planting strip | min 2 ft | `divider` default 0.5 m/2 ft | consistent |
| Street trees: palm, cherry (flowering) | — | `sidewalk-tree` `big` and `palm-tree`; **no cherry tree** | partial |
| Bike parking | heading only | `sidewalk-bike-rack`, `bikeshare` | exists |

### 8.4 `climate-resilience.md` (terminology glossary) vs Coastmix source
| Term | Source counterpart |
|---|---|
| Berm | `slope` segment (`rules.slope: berm`, `defaultSlope` 0.15→0.9 m; variants grass hill / sand dune); berm slope warning 3H:1V |
| Elevated roadway | per-slice `elevation` (0–5 m) and boundary elevation; `ELEVATION_CONTROLS_UNLOCKED` |
| Seawall | `wall` segment (`low`/`high`, owner `WALL`, zIndex 35) |
| Deployable barrier | no direct element; nearest `temporary` (jersey barriers) — UNVERIFIED intent |
| Coastal dune | `slope` `dune` variant; `beach` template "Dune" labels use `marsh` slices with slopes |
| Marsh | `marsh` segment and `marsh` boundary |
| Beach / nature-based | `beach` segment (beach, lounger), `beach` boundary |
| Rain gardens and bioswales | `bioswale` segment (named "Rain garden", `nameKey rain-garden`, SUBSCRIBE + COASTMIX_MODE), `drainage-channel` |
| Guard rail | `guardrail` segment (not in doc) |
| Sea level rise / storm surge | Coastmix plugin state `CoastmixState {seaLevelRise, stormSurge, floodDetails}` (`packages/types`), flood overlay in `client/src/plugins/coastmix` — UNVERIFIED details |
| Managed retreat, floodproofing, BFE/DFE | no element |

### 8.5 `streetmix-plus.md`
Lists member features: rename segments, change environmental backgrounds (matches §3 gating), export without watermark, print-resolution export (`SAVE_AS_IMAGE_CUSTOM_DPI` via SUBSCRIBER_1 role), "New segments: double decker bus, microvan, and autonomous shuttles" (matches `variant_icons.yaml` SUBSCRIBE on `bus-type: double-decker/av-shuttle`, `car-type: microvan`). Not mentioned in the doc but SUBSCRIBE-gated in source: `drainage-channel`, `bioswale`, `car-with-bus`, `car-with-bike`, universal elevation controls.

---

## 9. Fonts

| family | package / origin | version | license | usage |
|---|---|---|---|---|
| Rubik Variable | @fontsource-variable/rubik | 5.3.0 | OFL-1.1 | Body/UI font: --font-family in client/styles/_variables.css:160; imported in client/src/main.tsx:12-13 (incl. wght-italic) — Hubert & Fischer (per About dialog) |
| Manrope Variable | @fontsource-variable/manrope | 5.3.0 | OFL-1.1 | Heading font: --header-font-family in client/styles/_variables.css; imported client/src/main.tsx:10 — Mikhail Sharanda / gent.media (per About dialog) |
| Overpass Variable | @fontsource-variable/overpass | 5.3.0 | OFL-1.1 | Street nameplate: client/src/streets/StreetName.css:16; imported client/src/main.tsx:11 — Delve Fonts (per About dialog) |
| Montserrat | fontsource CDN (cdn.jsdelivr.net/fontsource/fonts/montserrat@5.3.0) | 5.3.0 | OFL-1.1 (Fontsource packaging of Google Fonts Montserrat; license not restated in repo) UNVERIFIED in-repo | @font-face in client/styles/_typography.css:45; used by Coastmix BostonHeader.css |
| Lora | fontsource CDN (cdn.jsdelivr.net/fontsource/fonts/lora@5.3.0) | 5.3.0 | OFL-1.1 (Fontsource packaging; license not restated in repo) UNVERIFIED in-repo | @font-face in client/styles/_typography.css:62; used by Coastmix BostonHeader.css:11 |
| Geist Sans | @fontsource/geist-sans | 5.3.0 | OFL-1.1 | Server-side image export only: packages/export-image/src/image.ts:39,46 (latin-400 and latin-600 woff2) |
| system-ui / Menlo / Courier New / monospace | — | — | system | fallbacks and debug output |


All Fontsource packages ship `license: OFL-1.1` in their `package.json` (`node_modules/@fontsource-variable/{manrope,overpass,rubik}`, `node_modules/@fontsource/geist-sans`). The About dialog (`client/src/dialogs/About/AboutDialog.tsx`) credits Manrope (gent.media), Rubik (Hubert & Fischer), Overpass (Delve Fonts), each linked to the SIL OFL 1.1; icons by Tabler and Font Awesome; emoji by OpenMoji (CC BY-SA 4.0). No `@fontsource/geist*` is used in the client; Geist is only embedded in server-side PNG export.

---

## 10. Notes / UNVERIFIED items

- `enableElevation` property on `sidewalk`, `street-vendor`, `crosswalk` is present in data but its consumer was not located by grep in `client/src` (UNVERIFIED).
- `train` has `variants: ['']` and a single detail key `''`; its variant string is the empty string.
- `drainage-channel` has **no `zIndex`** (and `crosswalk`, `bioswale`, `beach`, `marsh`, `guardrail`, `slope`, `magic-carpet`, `temporary` either have none or rely on object zIndex); canvas ordering then falls back to DOM order.
- `bikeshare`, `flex-zone`, `parking-lane` have metric `defaultWidth` (2 m) **below** their metric `minWidth` (2.1 m) — a fresh drop shows a `tooNarrow` warning for metric users but not imperial (7 ft vs 7 ft).
- `drainage-channel` imperial default 3.25 ft and `brt-lane` 11.667 ft are not on the ¼-ft resolution grid; they are normalised on drop.
- The capacity `'none'` source described in comments is not created by `processCapacityData`.
- `user_roles.json` `USER.flags.VARIANT_TWOWAY_BIKES` refers to a flag absent from `flags.json`.
- Illustrations CHANGELOG lists v3.0.0 breaking changes "in progress" (buildings optimised for metric, ground planes removed from boundaries, new sand/wall textures, guardrail, marsh plants, wall, beach lounger, beach people, beach/water/marsh/dock boundaries) — these assets are present, but `package.json` still says 2.2.0.
- Whether deprecated templates (`harborwalk`, `coastal_road`, `beach`) remain reachable via `/new?type=` was not traced through `app/` routing (UNVERIFIED).
