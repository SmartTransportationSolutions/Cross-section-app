/**
 * Browser-local street storage for people who are not signed in to GitHub.
 *
 * GitHub Pages has no server, so anonymous streets live in this browser
 * only. Signing in with GitHub "promotes" the current street to a gist.
 */
import type { StreetAPIResponse } from '@streetmix/types'

const STREETS_KEY = 'sts-street:local-streets'
const SEQUENCE_KEY = 'sts-street:local-sequence'

type LocalStreets = Record<string, StreetAPIResponse>

export class LocalStreetStore {
  private readonly storage: Storage

  constructor(storage: Storage) {
    this.storage = storage
  }

  private readAll(): LocalStreets {
    try {
      const raw = this.storage.getItem(STREETS_KEY)
      return raw ? (JSON.parse(raw) as LocalStreets) : {}
    } catch {
      return {}
    }
  }

  private writeAll(streets: LocalStreets): void {
    this.storage.setItem(STREETS_KEY, JSON.stringify(streets))
  }

  nextNamespacedId(): number {
    const current = Number.parseInt(this.storage.getItem(SEQUENCE_KEY) ?? '0', 10)
    const next = (Number.isInteger(current) ? current : 0) + 1
    this.storage.setItem(SEQUENCE_KEY, String(next))
    return next
  }

  get(id: string): StreetAPIResponse | null {
    return this.readAll()[id] ?? null
  }

  findByNamespacedId(namespacedId: number): StreetAPIResponse | null {
    return (
      Object.values(this.readAll()).find(
        (street) => street.namespacedId === namespacedId
      ) ?? null
    )
  }

  put(street: StreetAPIResponse): void {
    const all = this.readAll()
    all[street.id] = street
    this.writeAll(all)
  }

  delete(id: string): boolean {
    const all = this.readAll()
    if (!all[id]) return false
    delete all[id]
    this.writeAll(all)
    return true
  }

  list(): StreetAPIResponse[] {
    return Object.values(this.readAll()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    )
  }
}
