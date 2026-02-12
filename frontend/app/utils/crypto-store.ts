/**
 * Encrypted IndexedDB storage layer using Web Crypto API (AES-GCM-256).
 * Each record is encrypted with a key derived from the user's Cognito sub.
 */

const DB_NAME = 'i3speedex-cache-v1'
const DB_VERSION = 1
const STORE_NAMES = ['sales', 'buyers', 'producers', '_meta'] as const
const SALT = 'i3speedex-local-cache-v1'
const PBKDF2_ITERATIONS = 100_000

type StoreName = (typeof STORE_NAMES)[number]

interface EncryptedRecord {
  iv: Uint8Array
  ciphertext: ArrayBuffer
}

let db: IDBDatabase | null = null
let cryptoKey: CryptoKey | null = null

function isSupported(): boolean {
  return typeof indexedDB !== 'undefined'
    && typeof crypto !== 'undefined'
    && typeof crypto.subtle !== 'undefined'
}

async function deriveKey(userSub: string): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userSub),
    'PBKDF2',
    false,
    ['deriveKey'],
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode(SALT),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = () => {
      const database = request.result
      for (const name of STORE_NAMES) {
        if (!database.objectStoreNames.contains(name)) {
          database.createObjectStore(name)
        }
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function encrypt(data: unknown): Promise<EncryptedRecord> {
  if (!cryptoKey) throw new Error('CryptoStore not initialized')
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(JSON.stringify(data))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encoded,
  )
  return { iv, ciphertext }
}

async function decrypt<T>(record: EncryptedRecord): Promise<T> {
  if (!cryptoKey) throw new Error('CryptoStore not initialized')
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: record.iv },
    cryptoKey,
    record.ciphertext,
  )
  return JSON.parse(new TextDecoder().decode(decrypted))
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function idbTransaction(storeName: StoreName, mode: IDBTransactionMode): IDBObjectStore {
  if (!db) throw new Error('CryptoStore not initialized')
  const tx = db.transaction(storeName, mode)
  return tx.objectStore(storeName)
}

export const cryptoStore = {
  /**
   * Initialize the encrypted store. Returns false if not supported.
   */
  async init(userSub: string): Promise<boolean> {
    if (!isSupported()) return false

    try {
      cryptoKey = await deriveKey(userSub)
      db = await openDatabase()
      return true
    } catch {
      cryptoKey = null
      db = null
      return false
    }
  },

  async putItem(store: StoreName, id: string, data: unknown): Promise<void> {
    const encrypted = await encrypt(data)
    const objectStore = idbTransaction(store, 'readwrite')
    await idbRequest(objectStore.put(encrypted, id))
  },

  async getItem<T>(store: StoreName, id: string): Promise<T | null> {
    const objectStore = idbTransaction(store, 'readonly')
    const result = await idbRequest(objectStore.get(id))
    if (!result) return null
    return decrypt<T>(result)
  },

  async getAllItems<T>(store: StoreName): Promise<T[]> {
    const objectStore = idbTransaction(store, 'readonly')
    const allRecords: EncryptedRecord[] = await idbRequest(objectStore.getAll())
    const items: T[] = []
    for (const record of allRecords) {
      items.push(await decrypt<T>(record))
    }
    return items
  },

  async deleteItem(store: StoreName, id: string): Promise<void> {
    const objectStore = idbTransaction(store, 'readwrite')
    await idbRequest(objectStore.delete(id))
  },

  async clear(store: StoreName): Promise<void> {
    const objectStore = idbTransaction(store, 'readwrite')
    await idbRequest(objectStore.clear())
  },

  async getMeta(key: string): Promise<string | null> {
    return this.getItem<string>('_meta', key)
  },

  async setMeta(key: string, value: string): Promise<void> {
    await this.putItem('_meta', key, value)
  },

  destroy(): void {
    if (db) {
      db.close()
      db = null
    }
    cryptoKey = null
    indexedDB.deleteDatabase(DB_NAME)
  },
}
