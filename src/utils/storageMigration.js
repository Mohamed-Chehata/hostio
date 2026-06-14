const legacyStorageKeys = {
  "hostio-theme": "hostrack-theme",
  "hostio-currency": "hostrack-currency",
  "hostio-pending-sync": "hostrack-pending-sync",
  "hostio-sync-id-map": "hostrack-sync-id-map",
  "hostio-data-cache": "hostrack-data-cache",
  "hostio-base-cache": "hostrack-base-cache",
  "hostio-welcomed": "hostrack-welcomed",
  hostioPendingSignup: "hostrackPendingSignup",
  hostioPasswordRecovery: "hostrackPasswordRecovery"
};

export function migrateLegacyStorageKeys() {
  if (typeof window === "undefined") return;

  Object.entries(legacyStorageKeys).forEach(([legacyKey, nextKey]) => {
    const legacyValue = localStorage.getItem(legacyKey);

    if (legacyValue !== null && localStorage.getItem(nextKey) === null) {
      localStorage.setItem(nextKey, legacyValue);
    }

    if (legacyValue !== null) {
      localStorage.removeItem(legacyKey);
    }
  });
}

migrateLegacyStorageKeys();
