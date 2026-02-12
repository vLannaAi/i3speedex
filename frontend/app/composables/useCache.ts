import type { Sale, Buyer, Producer } from '~/types'
import { cryptoStore } from '~/utils/crypto-store'

type SyncEntity = 'sales' | 'buyers' | 'producers'

interface EntitySyncState {
  lastSync: string | null
  syncing: boolean
  count: number
}

interface SyncState {
  sales: EntitySyncState
  buyers: EntitySyncState
  producers: EntitySyncState
}

const syncState = reactive<SyncState>({
  sales: { lastSync: null, syncing: false, count: 0 },
  buyers: { lastSync: null, syncing: false, count: 0 },
  producers: { lastSync: null, syncing: false, count: 0 },
})

let initialized = false
let syncInterval: ReturnType<typeof setInterval> | null = null

const entityIdKey: Record<SyncEntity, string> = {
  sales: 'saleId',
  buyers: 'buyerId',
  producers: 'producerId',
}

export function useCache() {
  const { getSync } = useApi()

  async function initCache(userSub: string): Promise<boolean> {
    if (initialized) return true
    if (!import.meta.client) return false

    const ok = await cryptoStore.init(userSub)
    if (!ok) return false

    // Restore lastSync timestamps from meta
    for (const entity of ['sales', 'buyers', 'producers'] as SyncEntity[]) {
      const lastSync = await cryptoStore.getMeta(`lastSync_${entity}`)
      if (lastSync) {
        syncState[entity].lastSync = lastSync
        // Load count from cache
        const items = await cryptoStore.getAllItems(entity)
        syncState[entity].count = items.length
      }
    }

    initialized = true

    // Start background sync every 5 minutes
    if (syncInterval) clearInterval(syncInterval)
    syncInterval = setInterval(() => syncAll(), 5 * 60 * 1000)

    return true
  }

  function destroyCache(): void {
    if (syncInterval) {
      clearInterval(syncInterval)
      syncInterval = null
    }
    initialized = false
    cryptoStore.destroy()
    syncState.sales = { lastSync: null, syncing: false, count: 0 }
    syncState.buyers = { lastSync: null, syncing: false, count: 0 }
    syncState.producers = { lastSync: null, syncing: false, count: 0 }
  }

  async function syncEntity(entity: SyncEntity): Promise<void> {
    if (!initialized) return

    syncState[entity].syncing = true
    try {
      const since = syncState[entity].lastSync || undefined

      type EntityType = Sale | Buyer | Producer
      const res = await getSync<EntityType>(`/api/sync/${entity}`, since)

      if (!res.success || !res.data) return

      const { items, serverTimestamp } = res.data
      const idField = entityIdKey[entity]

      if (!since) {
        // Initial sync: clear store and insert all
        await cryptoStore.clear(entity)
        for (const item of items) {
          await cryptoStore.putItem(entity, (item as any)[idField], item)
        }
      } else {
        // Delta sync: upsert or delete
        for (const item of items) {
          if ((item as any).deletedAt) {
            await cryptoStore.deleteItem(entity, (item as any)[idField])
          } else {
            await cryptoStore.putItem(entity, (item as any)[idField], item)
          }
        }
      }

      // Update sync state
      syncState[entity].lastSync = serverTimestamp
      await cryptoStore.setMeta(`lastSync_${entity}`, serverTimestamp)

      // Update count
      const allItems = await cryptoStore.getAllItems(entity)
      syncState[entity].count = allItems.length
    } catch (error) {
      console.error(`[Cache] Sync failed for ${entity}:`, error)
    } finally {
      syncState[entity].syncing = false
    }
  }

  async function syncAll(): Promise<void> {
    await Promise.all([
      syncEntity('sales'),
      syncEntity('buyers'),
      syncEntity('producers'),
    ])
  }

  async function getAllCached<T>(entity: SyncEntity): Promise<T[]> {
    if (!initialized) return []
    return cryptoStore.getAllItems<T>(entity)
  }

  async function invalidateAndSync(entity: SyncEntity): Promise<void> {
    await syncEntity(entity)
  }

  const isReady = computed(() =>
    syncState.sales.lastSync !== null
    && syncState.buyers.lastSync !== null
    && syncState.producers.lastSync !== null,
  )

  return {
    syncState,
    isReady,
    initCache,
    destroyCache,
    syncEntity,
    syncAll,
    getAllCached,
    invalidateAndSync,
  }
}
