

let memorySeenCards = new Set<string>();

type AsyncStorageLike = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function getExplainCardKey(key: string) {
  return `explain-card:${key}`;
}

async function getStorage(): Promise<AsyncStorageLike | null> {
  try {
    const mod = await import("@react-native-async-storage/async-storage");
    const storage = mod?.default;

    if (
      storage &&
      typeof storage.getItem === "function" &&
      typeof storage.setItem === "function" &&
      typeof storage.removeItem === "function"
    ) {
      return storage as AsyncStorageLike;
    }

    return null;
  } catch (error) {
    console.log("AsyncStorage unavailable, using memory fallback", error);
    return null;
  }
}

export async function hasSeenExplainCard(key: string) {
  const storageKey = getExplainCardKey(key);
  const storage = await getStorage();

  if (!storage) {
    return memorySeenCards.has(storageKey);
  }

  try {
    const value = await storage.getItem(storageKey);
    return value === "1";
  } catch (error) {
    console.log("hasSeenExplainCard error", error);
    return memorySeenCards.has(storageKey);
  }
}

export async function markExplainCardSeen(key: string) {
  const storageKey = getExplainCardKey(key);
  const storage = await getStorage();

  if (!storage) {
    memorySeenCards.add(storageKey);
    return;
  }

  try {
    await storage.setItem(storageKey, "1");
    memorySeenCards.add(storageKey);
  } catch (error) {
    console.log("markExplainCardSeen error", error);
    memorySeenCards.add(storageKey);
  }
}

export async function clearExplainCardSeen(key: string) {
  const storageKey = getExplainCardKey(key);
  const storage = await getStorage();

  memorySeenCards.delete(storageKey);

  if (!storage) {
    return;
  }

  try {
    await storage.removeItem(storageKey);
  } catch (error) {
    console.log("clearExplainCardSeen error", error);
  }
}