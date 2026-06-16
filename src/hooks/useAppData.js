import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../lib/supabase";
import { countsAsRevenue, hasPendingCancellationPayout } from "../utils/paymentStatus";
import "../utils/storageMigration";

const SYNC_QUEUE_KEY = "hostrack-pending-sync";
const SYNC_ID_MAP_KEY = "hostrack-sync-id-map";
const DATA_CACHE_KEY = "hostrack-data-cache";
const BASE_CACHE_KEY = "hostrack-base-cache";
let syncProcessing = false;

function isNetworkAvailable() {
  return navigator.onLine;
}

function readStoredJson(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function createQueueId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function queuedBookingFromLegacy(source = {}) {
  return {
    id: source.id,
    guestName: source.guestName ?? source.guest_name ?? "",
    checkIn: source.checkIn ?? source.check_in ?? "",
    checkOut: source.checkOut ?? source.check_out ?? "",
    nights: Number(source.nights || 0),
    revenue: Number(source.revenue || 0),
    originalRevenue: source.originalRevenue ?? source.original_revenue ?? null,
    rating: source.rating ?? null,
    status: source.status === "paid" ? "Paid" : source.status === "unpaid" ? "Unpaid" : source.status,
    paymentOverride: source.paymentOverride ?? source.payment_override ?? null,
    bookingStatus: source.bookingStatus ?? source.booking_status ?? "active",
    cancellationPayoutPercent: source.cancellationPayoutPercent ?? source.cancellation_payout_percent ?? null,
    cancellationPayoutAvailableAt: source.cancellationPayoutAvailableAt ?? source.cancellation_payout_available_at ?? null
  };
}

function migrateQueuedOperation(operation) {
  if (!operation?.type || !operation.payload) return operation;
  const payload = operation.payload;
  if (operation.type === "updateBooking" || operation.type === "addBooking") {
    const source = payload.booking || payload.changes || payload.body || payload.data || payload.record || {};
    const booking = queuedBookingFromLegacy({ ...source, id: source.id ?? payload.id ?? payload.tempId });
    return {
      ...operation,
      payload: {
        booking,
        propertyId: payload.propertyId ?? source.property_id,
        originalMonth: payload.originalMonth,
        ...(operation.type === "addBooking" ? { tempId: payload.tempId ?? booking.id } : {})
      }
    };
  }
  return operation;
}

function readSyncQueue() {
  const stored = readStoredJson(SYNC_QUEUE_KEY, []);
  const localCreateIds = new Map();
  const migrated = (Array.isArray(stored) ? stored : []).map(migrateQueuedOperation).filter(Boolean).map((operation) => {
    if (operation.type !== "updateBooking") return operation;
    const queuedId = String(operation.payload.booking?.id || "");
    if (!queuedId.startsWith("booking-")) return operation;

    let tempId = localCreateIds.get(queuedId);
    if (!tempId) {
      tempId = `temp-${createQueueId()}`;
      localCreateIds.set(queuedId, tempId);
      return {
        ...operation,
        type: "addBooking",
        payload: {
          booking: { ...operation.payload.booking, id: tempId },
          propertyId: operation.payload.propertyId,
          tempId,
          legacyId: queuedId
        }
      };
    }
    return {
      ...operation,
      payload: {
        ...operation.payload,
        booking: { ...operation.payload.booking, id: tempId }
      }
    };
  });
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(migrated));
  return migrated;
}

function sanitizeCachedPendingState(storedCache, queue) {
  const bookingOperations = queue.filter((operation) => operation.type.includes("Booking"));
  const expenseOperations = queue.filter((operation) => operation.type.includes("Expense"));
  const costOperations = queue.filter((operation) => operation.type === "updateMonthlyCosts");
  return Object.fromEntries(Object.entries(storedCache || {}).map(([key, value]) => [
    key,
    {
      ...value,
      bookings: (value.bookings || []).map((booking) => ({
        ...booking,
        pendingSync: bookingOperations.some((operation) => {
          const queued = operation.payload.booking;
          return operation.payload.id === booking.id
            || queued?.id === booking.id
            || operation.payload.legacyId === booking.id
            || (queued?.guestName === booking.guestName && queued?.checkIn === booking.checkIn && queued?.checkOut === booking.checkOut);
        })
      })),
      expenses: (value.expenses || []).map((expense) => ({
        ...expense,
        pendingSync: expenseOperations.some((operation) => (
          operation.payload.id === expense.id
          || operation.payload.tempId === expense.id
          || operation.payload.row?.description === expense.description
        ))
      })),
      costs: value.costs ? {
        ...value.costs,
        pendingSync: costOperations.some((operation) => `${operation.payload.propertyId}-${operation.payload.month}` === key)
      } : value.costs
    }
  ]));
}

const defaultSettings = {
  currency: localStorage.getItem("hostrack-currency") || "EUR",
  currency_symbol: null,
  cost_label_1: "Rent",
  cost_label_2: "Cleaning",
  theme: localStorage.getItem("hostrack-theme") || "system"
};

function toBooking(row) {
  return {
    id: row.id,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    revenue: Number(row.revenue || 0),
    originalRevenue: row.original_revenue === null || row.original_revenue === undefined ? null : Number(row.original_revenue),
    rating: row.rating,
    status: row.status === "paid" ? "Paid" : "Unpaid",
    paymentOverride: row.payment_override ?? null,
    bookingStatus: row.booking_status || "active",
    cancellationPayoutPercent: row.cancellation_payout_percent === null || row.cancellation_payout_percent === undefined ? null : Number(row.cancellation_payout_percent),
    cancellationPayoutAvailableAt: row.cancellation_payout_available_at ?? null
  };
}

function fromBooking(booking, userId, propertyId) {
  return {
    id: String(booking.id).startsWith("booking-") || String(booking.id).startsWith("temp-") ? undefined : booking.id,
    property_id: propertyId,
    user_id: userId,
    guest_name: booking.guestName,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    nights: booking.nights,
    revenue: Number(booking.revenue || 0),
    original_revenue: booking.originalRevenue ?? null,
    rating: booking.rating ?? null,
    status: countsAsRevenue(booking) ? "paid" : "unpaid",
    payment_override: booking.paymentOverride ?? null,
    booking_status: booking.bookingStatus || "active",
    cancellation_payout_percent: booking.cancellationPayoutPercent ?? null,
    cancellation_payout_available_at: booking.cancellationPayoutAvailableAt ?? null
  };
}

function bookingChanges(booking) {
  return {
    guest_name: booking.guestName,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    nights: booking.nights,
    revenue: Number(booking.revenue || 0),
    original_revenue: booking.originalRevenue ?? null,
    rating: booking.rating ?? null,
    status: countsAsRevenue(booking) ? "paid" : "unpaid",
    payment_override: booking.paymentOverride ?? null,
    booking_status: booking.bookingStatus || "active",
    cancellation_payout_percent: booking.cancellationPayoutPercent ?? null,
    cancellation_payout_available_at: booking.cancellationPayoutAvailableAt ?? null
  };
}

function monthDays(month) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index, 0).getDate();
}

function buildSummary(month, bookings, costs, expenses) {
  const paidBookings = bookings.filter((booking) => countsAsRevenue(booking));
  const unpaidBookings = bookings.filter((booking) => !countsAsRevenue(booking));
  const totalRevenue = paidBookings.reduce((total, booking) => total + Number(booking.revenue || 0), 0);
  const unpaidRevenue = unpaidBookings.reduce((total, booking) => total + Number(booking.revenue || 0), 0);
  const activeBookings = bookings.filter((booking) => booking.bookingStatus !== "cancelled");
  const occupancyNights = activeBookings.reduce((total, booking) => total + Number(booking.nights || 0), 0);
  const expenseTotal = expenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
  const rent = Number(costs?.cost_1 || 0);
  const cleaning = Number(costs?.cost_2 || 0);
  return {
    month,
    rent,
    cleaning,
    randomExpenses: expenses,
    expenses: expenseTotal,
    totalRevenue,
    unpaidRevenue,
    pendingPayouts: bookings.filter((booking) => hasPendingCancellationPayout(booking)),
    occupancyNights,
    occupancyRate: Math.min(100, Math.round((occupancyNights / monthDays(month)) * 100)),
    netRevenue: totalRevenue - rent - cleaning - expenseTotal,
    pendingSync: Boolean(costs?.pendingSync)
  };
}

function toExpense(row) {
  return {
    id: row.id,
    description: row.description,
    amount: Number(row.amount || 0),
    date: row.expense_date,
    createdAt: `${row.expense_date}T${row.expense_time || "00:00:00"}`
  };
}

function logError(error) {
  if (import.meta.env.DEV) console.error(error?.message || error);
}

function blankCostRow(month, userId, propertyId) {
  return {
    month,
    user_id: userId,
    property_id: propertyId,
    cost_1: 0,
    cost_2: 0
  };
}

function toBookingConflict(row) {
  return {
    id: row.id,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out
  };
}

export function useAppData(user, months = []) {
  const userId = user?.id;
  const cachedBaseForUser = (() => {
    const cached = readStoredJson(BASE_CACHE_KEY, null);
    return cached?.userId === userId ? cached : null;
  })();
  const [properties, setProperties] = useState(cachedBaseForUser?.properties || []);
  const [baseInitialized, setBaseInitialized] = useState(Boolean(cachedBaseForUser));
  const [activePropertyId, setActivePropertyIdState] = useState(() => localStorage.getItem("activePropertyId") || "");
  const [userSettings, setUserSettings] = useState(cachedBaseForUser?.userSettings || defaultSettings);
  const [bookingsByMonth, setBookingsByMonth] = useState({});
  const [costsByMonth, setCostsByMonth] = useState({});
  const [expensesByMonth, setExpensesByMonth] = useState({});
  const [statsMonths, setStatsMonths] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsInitialized, setStatsInitialized] = useState(false);
  const [allPropertiesMonths, setAllPropertiesMonths] = useState({});
  const [allPropertiesLoadingMonths, setAllPropertiesLoadingMonths] = useState(() => new Set());
  const [allPropertiesInitializedMonths, setAllPropertiesInitializedMonths] = useState(() => new Set());
  const [loadingKeys, setLoadingKeys] = useState(() => new Set());
  const [, setInitializationVersion] = useState(0);
  const [error, setError] = useState(null);
  const [isOnline, setIsOnline] = useState(isNetworkAvailable);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncQueue, setSyncQueue] = useState(readSyncQueue);
  const [syncFailures, setSyncFailures] = useState([]);
  const [offlineUnavailableKeys, setOfflineUnavailableKeys] = useState(() => new Set());
  const fetchCache = useRef(new Map(Object.entries(sanitizeCachedPendingState(readStoredJson(DATA_CACHE_KEY, {}), syncQueue))));
  const statsCache = useRef(new Map());
  const allPropertiesCache = useRef(new Map());
  const allPropertiesInFlight = useRef(new Map());
  const inFlightFetches = useRef(new Map());
  const fetchKeyRef = useRef(new Map());
  const initializedKeys = useRef(new Set());
  const activePropertyIdRef = useRef(activePropertyId);
  const syncQueueRef = useRef(syncQueue);
  const syncingRef = useRef(false);

  function persistDataCache() {
    localStorage.setItem(DATA_CACHE_KEY, JSON.stringify(Object.fromEntries(fetchCache.current)));
  }

  function updateCachedEntities(entityType, updater) {
    fetchCache.current.forEach((cached, key) => {
      const field = entityType === "booking" ? "bookings" : "expenses";
      fetchCache.current.set(key, { ...cached, [field]: updater(cached[field] || []) });
    });
    persistDataCache();
  }

  const activeProperty = useMemo(() => properties.find((property) => property.id === activePropertyId) || properties[0] || null, [activePropertyId, properties]);
  const costLabels = useMemo(() => ({
    rent: userSettings.cost_label_1 || "Rent",
    cleaning: userSettings.cost_label_2 || "Cleaning"
  }), [userSettings.cost_label_1, userSettings.cost_label_2]);

  const monthKey = months.filter(Boolean).join("|");
  const loadedMonths = useMemo(() => [...new Set(monthKey.split("|").filter(Boolean))], [monthKey]);

  useEffect(() => {
    activePropertyIdRef.current = activePropertyId;
  }, [activePropertyId]);

  useEffect(() => {
    syncQueueRef.current = syncQueue;
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(syncQueue));
  }, [syncQueue]);

  useEffect(() => {
    const queuedIds = new Set(syncQueue.map((operation) => operation.id));
    setSyncFailures((current) => current.filter((failure) => queuedIds.has(failure.id)));
  }, [syncQueue]);

  function enqueueSync(type, payload) {
    const operation = { id: createQueueId(), type, payload, timestamp: Date.now() };
    setSyncQueue((current) => [...current, operation]);
    return operation;
  }

  function resolveSyncId(id, idMap) {
    return idMap[id] || id;
  }

  function markEntitySynced(tempId, realId, entityType, legacyId, queuedEntity) {
    const replaceEntity = (rows) => rows.map((row) => (
      row.id === tempId
      || row.id === legacyId
      || (queuedEntity && row.guestName === queuedEntity.guestName && row.checkIn === queuedEntity.checkIn && row.checkOut === queuedEntity.checkOut)
        ? { ...row, id: realId, pendingSync: false }
        : row
    ));
    if (entityType === "booking") {
      setBookingsByMonth((current) => Object.fromEntries(Object.entries(current).map(([month, rows]) => [
        month,
        replaceEntity(rows)
      ])));
    } else {
      setExpensesByMonth((current) => Object.fromEntries(Object.entries(current).map(([month, rows]) => [
        month,
        replaceEntity(rows)
      ])));
    }
    updateCachedEntities(entityType, replaceEntity);
  }

  async function executeQueuedOperation(operation, idMap) {
    const { type, payload } = operation;
    if (type === "addBooking") {
      const { data, error: syncError } = await supabase.from("bookings").insert(fromBooking(payload.booking, userId, payload.propertyId)).select("*").single();
      if (syncError) throw syncError;
      idMap[payload.tempId] = data.id;
      markEntitySynced(payload.tempId, data.id, "booking", payload.legacyId, payload.booking);
      return;
    }
    if (type === "updateBooking") {
      const id = resolveSyncId(payload.booking.id, idMap);
      if (String(id).startsWith("temp-")) throw new Error("Waiting for the booking to be created");
      const { data, error: syncError } = await supabase
        .from("bookings")
        .update(bookingChanges(payload.booking))
        .eq("user_id", userId)
        .eq("property_id", payload.propertyId)
        .eq("id", id)
        .select("id")
        .maybeSingle();
      if (syncError) throw syncError;
      if (!data) throw new Error("Booking no longer exists");
      const queuedId = payload.booking.id;
      setBookingsByMonth((current) => Object.fromEntries(Object.entries(current).map(([month, rows]) => [
        month,
        rows.map((row) => row.id === queuedId || row.id === id ? { ...row, id, pendingSync: false } : row)
      ])));
      updateCachedEntities("booking", (rows) => rows.map((row) => row.id === queuedId || row.id === id ? { ...row, id, pendingSync: false } : row));
      return;
    }
    if (type === "deleteBooking") {
      const id = resolveSyncId(payload.id, idMap);
      if (String(id).startsWith("temp-")) throw new Error("Waiting for the booking to be created");
      const { error: syncError } = await supabase.from("bookings").delete().eq("user_id", userId).eq("property_id", payload.propertyId).eq("id", id);
      if (syncError) throw syncError;
      return;
    }
    if (type === "updateMonthlyCosts") {
      const { error: syncError } = await supabase.from("monthly_costs").upsert(payload.costs, { onConflict: "property_id,month" });
      if (syncError) throw syncError;
      setCostsByMonth((current) => ({
        ...current,
        [payload.month]: current[payload.month] ? { ...current[payload.month], pendingSync: false } : current[payload.month]
      }));
      const cacheKey = `${payload.propertyId}-${payload.month}`;
      const cached = fetchCache.current.get(cacheKey);
      if (cached) {
        fetchCache.current.set(cacheKey, {
          ...cached,
          costs: cached.costs ? { ...cached.costs, pendingSync: false } : cached.costs
        });
        persistDataCache();
      }
      return;
    }
    if (type === "addExpense") {
      const { data, error: syncError } = await supabase.from("expenses").insert(payload.row).select("*").single();
      if (syncError) throw syncError;
      idMap[payload.tempId] = data.id;
      markEntitySynced(payload.tempId, data.id, "expense");
      return;
    }
    if (type === "updateExpense") {
      const id = resolveSyncId(payload.id, idMap);
      if (String(id).startsWith("temp-")) throw new Error("Waiting for the expense to be created");
      const { error: syncError } = await supabase.from("expenses").update(payload.changes).eq("user_id", userId).eq("property_id", payload.propertyId).eq("id", id);
      if (syncError) throw syncError;
      setExpensesByMonth((current) => Object.fromEntries(Object.entries(current).map(([month, rows]) => [
        month,
        rows.map((row) => row.id === payload.id ? { ...row, pendingSync: false } : row)
      ])));
      updateCachedEntities("expense", (rows) => rows.map((row) => row.id === payload.id ? { ...row, pendingSync: false } : row));
      return;
    }
    if (type === "deleteExpense") {
      const id = resolveSyncId(payload.id, idMap);
      if (String(id).startsWith("temp-")) throw new Error("Waiting for the expense to be created");
      const { error: syncError } = await supabase.from("expenses").delete().eq("user_id", userId).eq("property_id", payload.propertyId).eq("id", id);
      if (syncError) throw syncError;
    }
  }

  function syncFailure(operation, syncError) {
    return {
      ...operation,
      reason: syncError.code === "23P01" || syncError.message?.includes("no_overlapping_bookings")
        ? "Booking dates conflict"
        : "Couldn't save this change",
      errorCode: syncError.code || syncError.status || null,
      errorMessage: syncError.message || ""
    };
  }

  async function retrySyncOperation(id) {
    if (!isNetworkAvailable() || syncingRef.current) return { success: false };
    const operation = syncQueueRef.current.find((item) => item.id === id);
    if (!operation) {
      setSyncFailures((current) => current.filter((failure) => failure.id !== id));
      return { success: true };
    }
    const idMap = readStoredJson(SYNC_ID_MAP_KEY, {});
    try {
      await executeQueuedOperation(operation, idMap);
      localStorage.setItem(SYNC_ID_MAP_KEY, JSON.stringify(idMap));
      setSyncQueue((current) => current.filter((item) => item.id !== id));
      setSyncFailures((current) => current.filter((failure) => failure.id !== id));
      return { success: true };
    } catch (syncError) {
      logError(syncError);
      const failure = syncFailure(operation, syncError);
      setSyncFailures((current) => [...current.filter((item) => item.id !== id), failure]);
      return { success: false, failure };
    }
  }

  const processSyncQueue = useCallback(async () => {
    if (!isNetworkAvailable() || syncingRef.current || syncProcessing || !userId || !syncQueueRef.current.length) return;
    syncProcessing = true;
    syncingRef.current = true;
    setIsSyncing(true);
    setSyncFailures([]);
    const idMap = readStoredJson(SYNC_ID_MAP_KEY, {});
    const failed = [];
    for (const operation of [...syncQueueRef.current]) {
      try {
        await executeQueuedOperation(operation, idMap);
        setSyncQueue((current) => current.filter((item) => item.id !== operation.id));
        localStorage.setItem(SYNC_ID_MAP_KEY, JSON.stringify(idMap));
      } catch (syncError) {
        logError(syncError);
        failed.push(syncFailure(operation, syncError));
      }
    }
    setSyncFailures(failed);
    syncingRef.current = false;
    syncProcessing = false;
    setIsSyncing(false);
  }, [userId]);

  useEffect(() => {
    function handleOffline() {
      setIsOnline(false);
    }
    function handleOnline() {
      setIsOnline(true);
      processSyncQueue();
    }
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    if (isNetworkAvailable() && syncQueueRef.current.length) processSyncQueue();
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, [processSyncQueue]);

  async function discardSyncOperation(id) {
    const operation = syncQueueRef.current.find((item) => item.id === id);
    setSyncQueue((current) => current.filter((operation) => operation.id !== id));
    setSyncFailures((current) => current.filter((operation) => operation.id !== id));
    if (!operation || !isNetworkAvailable()) return;

    const propertyId = operation.payload.propertyId;
    const months = new Set([
      operation.payload.month,
      operation.payload.originalMonth,
      operation.payload.booking?.checkIn?.slice(0, 7)
    ].filter(Boolean));

    months.forEach((month) => {
      const key = `${propertyId}-${month}`;
      fetchCache.current.delete(key);
      initializedKeys.current.delete(key);
    });
    persistDataCache();

    if (propertyId === activePropertyIdRef.current) {
      await Promise.all([...months].map((month) => fetchMonth(propertyId, month)));
    }
  }

  function dismissSyncFailures() {
    setSyncFailures([]);
  }

  useEffect(() => {
    if (userId) return;
    inFlightFetches.current.forEach(({ controller }) => controller.abort());
    inFlightFetches.current.clear();
    setProperties([]);
    setBaseInitialized(false);
    setActivePropertyIdState("");
    setUserSettings(defaultSettings);
    setBookingsByMonth({});
    setCostsByMonth({});
    setExpensesByMonth({});
    setStatsMonths([]);
    setStatsLoading(false);
    setStatsInitialized(false);
    setAllPropertiesMonths({});
    setAllPropertiesLoadingMonths(new Set());
    setAllPropertiesInitializedMonths(new Set());
    setError(null);
    setLoadingKeys(new Set());
    statsCache.current.clear();
    allPropertiesCache.current.clear();
    allPropertiesInFlight.current.clear();
    initializedKeys.current.clear();
  }, [userId]);

  function reportError(nextError) {
    logError(nextError);
    setError(nextError);
  }

  function setActivePropertyId(id) {
    if (!id || id === activePropertyIdRef.current) return;
    inFlightFetches.current.forEach(({ controller }, key) => {
      if (!key.startsWith("base:")) controller.abort();
    });
    inFlightFetches.current.forEach((_, key) => {
      if (!key.startsWith("base:")) inFlightFetches.current.delete(key);
    });
    fetchKeyRef.current.clear();
    statsCache.current.clear();
    initializedKeys.current.clear();
    activePropertyIdRef.current = id;
    localStorage.setItem("activePropertyId", id);
    setActivePropertyIdState(id);
  }

  const fetchPropertiesAndSettings = useCallback(async () => {
    if (!userId) return null;
    const cachedBase = readStoredJson(BASE_CACHE_KEY, null);
    if (cachedBase?.userId === userId) {
      setProperties(cachedBase.properties || []);
      setUserSettings(cachedBase.userSettings || defaultSettings);
      const saved = localStorage.getItem("activePropertyId");
      const nextActive = cachedBase.properties?.some((property) => property.id === saved) ? saved : cachedBase.properties?.[0]?.id || "";
      if (nextActive) setActivePropertyId(nextActive);
      setBaseInitialized(true);
    } else {
      setBaseInitialized(false);
    }
    if (!isNetworkAvailable()) {
      if (cachedBase?.userId === userId) {
        return cachedBase.properties || [];
      }
      setBaseInitialized(true);
      return null;
    }
    const key = `base:${userId}`;
    const existing = inFlightFetches.current.get(key);
    if (existing) return existing.promise;
    const controller = new AbortController();
    setError(null);
    const promise = (async () => {
      const [{ data: propertyRows, error: propertiesError }, { data: settingsRow, error: settingsError }] = await Promise.all([
        supabase.from("properties").select("*").eq("user_id", userId).order("created_at", { ascending: true }).abortSignal(controller.signal),
        supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle().abortSignal(controller.signal)
      ]);
      if (controller.signal.aborted) return null;
      if (propertiesError || settingsError) {
        reportError(propertiesError || settingsError);
        return null;
      }
      setProperties(propertyRows || []);
      allPropertiesCache.current.clear();
      setAllPropertiesMonths({});
      setAllPropertiesInitializedMonths(new Set());
      const nextSettings = settingsRow || defaultSettings;
      setUserSettings(nextSettings);
      localStorage.setItem("hostrack-theme", nextSettings.theme || "system");
      localStorage.setItem(BASE_CACHE_KEY, JSON.stringify({ userId, properties: propertyRows || [], userSettings: nextSettings }));
      const saved = localStorage.getItem("activePropertyId");
      const nextActive = propertyRows?.some((property) => property.id === saved) ? saved : propertyRows?.[0]?.id || "";
      if (nextActive) setActivePropertyId(nextActive);
      return propertyRows || [];
    })().catch((fetchError) => {
      if (!controller.signal.aborted) reportError(fetchError);
      return null;
    }).finally(() => {
      if (!controller.signal.aborted) setBaseInitialized(true);
      if (inFlightFetches.current.get(key)?.controller === controller) {
        inFlightFetches.current.delete(key);
      }
    });
    inFlightFetches.current.set(key, { controller, promise });
    return promise;
  }, [userId]);

  const applyMonthData = useCallback((month, value) => {
    setBookingsByMonth((current) => ({ ...current, [month]: value.bookings }));
    setCostsByMonth((current) => ({ ...current, [month]: value.costs }));
    setExpensesByMonth((current) => ({ ...current, [month]: value.expenses }));
  }, []);

  const markInitialized = useCallback((key) => {
    if (initializedKeys.current.has(key)) return;
    initializedKeys.current.add(key);
    setInitializationVersion((version) => version + 1);
  }, []);

  const setKeyLoading = useCallback((key, loading) => {
    setLoadingKeys((current) => {
      const next = new Set(current);
      if (loading) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const fetchMonth = useCallback((propertyId, month, options = {}) => {
    if (!userId || !propertyId || !month) return Promise.resolve(null);
    const { force = false, background = false } = options;
    const key = `${propertyId}-${month}`;
    if (force) {
      fetchCache.current.delete(key);
      persistDataCache();
    }
    const cached = fetchCache.current.get(key);
    if (cached) {
      applyMonthData(month, cached);
      markInitialized(key);
      if (!isNetworkAvailable()) return Promise.resolve(cached);
    }
    if (!isNetworkAvailable()) {
      setOfflineUnavailableKeys((current) => new Set(current).add(key));
      markInitialized(key);
      return Promise.resolve(null);
    }
    setOfflineUnavailableKeys((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });

    const existing = inFlightFetches.current.get(key);
    if (existing) return existing.promise;

    const controller = new AbortController();
    fetchKeyRef.current.set(month, key);
    if (!cached && !background) setKeyLoading(key, true);
    setError(null);

    const promise = (async () => {
      const firstDay = `${month}-01`;
      const lastDay = `${month}-${String(monthDays(month)).padStart(2, "0")}`;
      const [bookingsResult, costsResult, expensesResult] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", userId).eq("property_id", propertyId).gte("check_in", firstDay).lte("check_in", lastDay).order("check_in", { ascending: true }).abortSignal(controller.signal),
        supabase.from("monthly_costs").select("*").eq("user_id", userId).eq("property_id", propertyId).eq("month", month).maybeSingle().abortSignal(controller.signal),
        supabase.from("expenses").select("*").eq("user_id", userId).eq("property_id", propertyId).eq("month", month).order("created_at", { ascending: false }).abortSignal(controller.signal)
      ]);

      if (controller.signal.aborted) return null;
      if (bookingsResult.error || costsResult.error || expensesResult.error) {
        reportError(bookingsResult.error || costsResult.error || expensesResult.error);
        return null;
      }

      const costRow = costsResult.data || blankCostRow(month, userId, propertyId);

      const value = {
        bookings: (bookingsResult.data || []).map(toBooking),
        costs: costRow,
        expenses: (expensesResult.data || []).map(toExpense)
      };
      if (fetchKeyRef.current.get(month) !== key || activePropertyIdRef.current !== propertyId) return null;
      fetchCache.current.set(key, value);
      persistDataCache();
      applyMonthData(month, value);
      markInitialized(key);
      return value;
    })().catch((fetchError) => {
      if (!controller.signal.aborted) reportError(fetchError);
      return null;
    }).finally(() => {
      if (inFlightFetches.current.get(key)?.controller === controller) {
        inFlightFetches.current.delete(key);
        if (!cached && !background) setKeyLoading(key, false);
      }
    });

    inFlightFetches.current.set(key, { controller, promise });
    return promise;
  }, [applyMonthData, markInitialized, setKeyLoading, userId]);

  const fetchMonths = useCallback((propertyId = activePropertyIdRef.current, targetMonths = loadedMonths) => {
    if (!userId || !propertyId || !targetMonths.length) return Promise.resolve([]);
    return Promise.all([...new Set(targetMonths.filter(Boolean))].map((month) => fetchMonth(propertyId, month)));
  }, [fetchMonth, loadedMonths, userId]);

  useEffect(() => {
    inFlightFetches.current.forEach(({ controller }) => controller.abort());
    inFlightFetches.current.clear();
    fetchKeyRef.current.clear();
    statsCache.current.clear();
    initializedKeys.current.clear();
    setInitializationVersion((version) => version + 1);
    setLoadingKeys(new Set());
    setBookingsByMonth({});
    setCostsByMonth({});
    setExpensesByMonth({});
    setStatsMonths([]);
    setStatsLoading(false);
    setStatsInitialized(false);
  }, [activePropertyId]);

  useEffect(() => {
    fetchPropertiesAndSettings();
  }, [fetchPropertiesAndSettings]);

  useEffect(() => {
    if (!activePropertyId || !loadedMonths.length) return;
    const desiredKeys = new Set(loadedMonths.map((month) => `${activePropertyId}-${month}`));
    inFlightFetches.current.forEach(({ controller }, key) => {
      if (!key.startsWith("stats:") && !desiredKeys.has(key)) {
        controller.abort();
        inFlightFetches.current.delete(key);
        setKeyLoading(key, false);
      }
    });
    fetchMonths();
  }, [activePropertyId, fetchMonths, loadedMonths, setKeyLoading]);

  const bookings = useMemo(() => Object.values(bookingsByMonth).flat(), [bookingsByMonth]);
  const monthlyStats = useMemo(() => loadedMonths.map((month) => buildSummary(month, bookingsByMonth[month] || [], costsByMonth[month], expensesByMonth[month] || [])), [bookingsByMonth, costsByMonth, expensesByMonth, loadedMonths]);

  async function fetchStatsMonths(options = {}) {
    if (!userId || !activePropertyId) return null;
    const { force = false, background = false } = options;
    const key = `stats:${activePropertyId}`;
    if (force) statsCache.current.delete(key);
    const cached = statsCache.current.get(key);
    if (cached) {
      setStatsMonths(cached);
      setStatsInitialized(true);
      return cached;
    }
    if (!isNetworkAvailable()) {
      setStatsInitialized(true);
      return null;
    }
    const existing = inFlightFetches.current.get(key);
    if (existing) return existing.promise;
    const controller = new AbortController();
    if (!background) setStatsLoading(true);
    const promise = (async () => {
      const [bookingsResult, costsResult, expensesResult] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", userId).eq("property_id", activePropertyId).abortSignal(controller.signal),
        supabase.from("monthly_costs").select("*").eq("user_id", userId).eq("property_id", activePropertyId).abortSignal(controller.signal),
        supabase.from("expenses").select("*").eq("user_id", userId).eq("property_id", activePropertyId).abortSignal(controller.signal)
      ]);
      if (controller.signal.aborted) return null;
      if (bookingsResult.error || costsResult.error || expensesResult.error) {
        reportError(bookingsResult.error || costsResult.error || expensesResult.error);
        return null;
      }
      const months = new Set([
        ...(bookingsResult.data || []).map((booking) => booking.check_in.slice(0, 7)),
        ...(costsResult.data || []).map((cost) => cost.month),
        ...(expensesResult.data || []).map((expense) => expense.month)
      ]);
      const stats = [...months].sort().map((month) => buildSummary(
        month,
        (bookingsResult.data || []).filter((booking) => booking.check_in.startsWith(month)).map(toBooking),
        (costsResult.data || []).find((cost) => cost.month === month),
        (expensesResult.data || []).filter((expense) => expense.month === month).map(toExpense)
      ));
      if (activePropertyIdRef.current !== activePropertyId) return null;
      statsCache.current.set(key, stats);
      setStatsMonths(stats);
      setStatsInitialized(true);
      return stats;
    })().catch((fetchError) => {
      if (!controller.signal.aborted) reportError(fetchError);
      return null;
    }).finally(() => {
      if (inFlightFetches.current.get(key)?.controller === controller) {
        inFlightFetches.current.delete(key);
        if (!background) setStatsLoading(false);
      }
    });
    inFlightFetches.current.set(key, { controller, promise });
    return promise;
  }

  async function fetchAllPropertiesMonth(month, options = {}) {
    if (!userId || !month || !properties.length) return null;
    const { force = false, background = false } = options;
    const key = `${userId}-${month}`;
    if (force) allPropertiesCache.current.delete(key);
    const cached = allPropertiesCache.current.get(key);
    if (cached) {
      setAllPropertiesMonths((current) => ({ ...current, [month]: cached }));
      setAllPropertiesInitializedMonths((current) => new Set(current).add(month));
      return cached;
    }
    if (!isNetworkAvailable()) {
      setAllPropertiesInitializedMonths((current) => new Set(current).add(month));
      return null;
    }
    const existing = allPropertiesInFlight.current.get(key);
    if (existing) return existing;

    if (!background) setAllPropertiesLoadingMonths((current) => new Set(current).add(month));
    const promise = (async () => {
      const firstDay = `${month}-01`;
      const lastDay = `${month}-${String(monthDays(month)).padStart(2, "0")}`;
      const propertyIds = properties.map((property) => property.id);
      const [bookingsResult, costsResult, expensesResult] = await Promise.all([
        supabase.from("bookings").select("*").eq("user_id", userId).in("property_id", propertyIds).gte("check_in", firstDay).lte("check_in", lastDay),
        supabase.from("monthly_costs").select("*").eq("user_id", userId).in("property_id", propertyIds).eq("month", month),
        supabase.from("expenses").select("*").eq("user_id", userId).in("property_id", propertyIds).eq("month", month)
      ]);
      if (bookingsResult.error || costsResult.error || expensesResult.error) {
        reportError(bookingsResult.error || costsResult.error || expensesResult.error);
        return null;
      }

      const propertyStats = properties.map((property) => {
        const propertyBookings = (bookingsResult.data || []).filter((booking) => booking.property_id === property.id).map(toBooking);
        const propertyCosts = (costsResult.data || []).find((cost) => cost.property_id === property.id);
        const propertyExpenses = (expensesResult.data || []).filter((expense) => expense.property_id === property.id).map(toExpense);
        return {
          property,
          ...buildSummary(month, propertyBookings, propertyCosts, propertyExpenses)
        };
      });
      const aggregate = {
        month,
        totalRevenue: propertyStats.reduce((total, item) => total + item.totalRevenue, 0),
        unpaidRevenue: propertyStats.reduce((total, item) => total + item.unpaidRevenue, 0),
        occupancyNights: propertyStats.reduce((total, item) => total + item.occupancyNights, 0),
        netRevenue: propertyStats.reduce((total, item) => total + item.netRevenue, 0),
        occupancyRate: Math.min(100, Math.round(
          propertyStats.reduce((total, item) => total + item.occupancyNights, 0) /
          (monthDays(month) * Math.max(1, propertyStats.length)) * 100
        ))
      };
      const value = { aggregate, propertyStats };
      allPropertiesCache.current.set(key, value);
      setAllPropertiesMonths((current) => ({ ...current, [month]: value }));
      setAllPropertiesInitializedMonths((current) => new Set(current).add(month));
      return value;
    })().finally(() => {
      allPropertiesInFlight.current.delete(key);
      if (!background) {
        setAllPropertiesLoadingMonths((current) => {
          const next = new Set(current);
          next.delete(month);
          return next;
        });
      }
    });
    allPropertiesInFlight.current.set(key, promise);
    return promise;
  }

  function setMonthBookings(month, updater) {
    setBookingsByMonth((current) => ({ ...current, [month]: updater(current[month] || []) }));
  }

  function setMonthExpenses(month, updater) {
    setExpensesByMonth((current) => ({ ...current, [month]: updater(current[month] || []) }));
  }

  function invalidateAllPropertiesMonth(month) {
    allPropertiesCache.current.delete(`${userId}-${month}`);
    setAllPropertiesMonths((current) => {
      const next = { ...current };
      delete next[month];
      return next;
    });
    setAllPropertiesInitializedMonths((current) => {
      const next = new Set(current);
      next.delete(month);
      return next;
    });
  }

  function updateMonthCache(month, updater) {
    const key = `${activePropertyId}-${month}`;
    const cached = fetchCache.current.get(key);
    if (cached) {
      fetchCache.current.set(key, updater(cached));
      persistDataCache();
    }
    statsCache.current.clear();
    invalidateAllPropertiesMonth(month);
  }

  async function findBookingConflict(booking) {
    if (!userId || !activePropertyId || !booking.checkIn || !booking.checkOut) return null;
    let query = supabase
      .from("bookings")
      .select("id, guest_name, check_in, check_out, booking_status")
      .eq("user_id", userId)
      .eq("property_id", activePropertyId)
      .lt("check_in", booking.checkOut)
      .gt("check_out", booking.checkIn)
      .neq("booking_status", "cancelled")
      .order("check_in", { ascending: true })
      .limit(1);

    if (booking.id && !String(booking.id).startsWith("booking-")) {
      query = query.neq("id", booking.id);
    }

    const { data, error: conflictError } = await query;
    if (conflictError) {
      reportError(conflictError);
      return null;
    }
    return data?.[0] ? toBookingConflict(data[0]) : null;
  }

  async function checkBookingConflict(booking) {
    if (!isNetworkAvailable()) {
      return bookings.find((item) => (
        item.id !== booking.id
        && item.bookingStatus !== "cancelled"
        && booking.checkIn < item.checkOut
        && booking.checkOut > item.checkIn
      )) || null;
    }
    return findBookingConflict(booking);
  }

  async function checkImportConflicts(propertyId, records) {
    if (!userId || !propertyId || !records.length) return { ready: records, conflicts: [] };
    const firstCheckIn = records.reduce((earliest, record) => record.checkIn < earliest ? record.checkIn : earliest, records[0].checkIn);
    const lastCheckOut = records.reduce((latest, record) => record.checkOut > latest ? record.checkOut : latest, records[0].checkOut);
    const { data, error: conflictError } = await supabase
      .from("bookings")
      .select("id, guest_name, check_in, check_out, booking_status")
      .eq("user_id", userId)
      .eq("property_id", propertyId)
      .neq("booking_status", "cancelled")
      .lt("check_in", lastCheckOut)
      .gt("check_out", firstCheckIn)
      .order("check_in", { ascending: true });
    if (conflictError) {
      reportError(conflictError);
      return null;
    }

    const existing = (data || []).map(toBookingConflict);
    const ready = [];
    const conflicts = [];
    records.forEach((record) => {
      const existingConflict = existing.find((booking) => record.checkIn < booking.checkOut && record.checkOut > booking.checkIn);
      const fileConflict = ready.find((booking) => record.checkIn < booking.checkOut && record.checkOut > booking.checkIn);
      const conflict = existingConflict || fileConflict;
      if (!conflict) {
        ready.push(record);
        return;
      }
      conflicts.push({
        record,
        source: existingConflict ? "existing" : "file",
        conflict: { guestName: conflict.guestName, checkIn: conflict.checkIn, checkOut: conflict.checkOut }
      });
    });
    return { ready, conflicts };
  }

  async function importBookings(propertyId, records, onProgress) {
    if (!userId || !propertyId || !records.length) {
      return { succeeded: [], failed: records.map((record) => ({ record, reason: "Something went wrong" })), insertedCount: 0 };
    }
    const succeeded = [];
    const failed = [];
    const batchSize = 50;
    for (let start = 0; start < records.length; start += batchSize) {
      const batch = records.slice(start, start + batchSize);
      const payload = batch.map((record) => ({
        property_id: propertyId,
        user_id: userId,
        guest_name: record.guestName,
        check_in: record.checkIn,
        check_out: record.checkOut,
        nights: record.nights,
        revenue: Number(record.revenue || 0),
        rating: null,
        status: record.paymentOverride === "paid" ? "paid" : "unpaid",
        payment_override: record.paymentOverride ?? null,
        booking_status: "active",
        cancellation_payout_percent: null,
        cancellation_payout_available_at: null,
        original_revenue: null
      }));
      const { data, error: importError } = await supabase.from("bookings").insert(payload).select("*");
      if (importError) {
        reportError(importError);
        batch.forEach((record) => failed.push({ record, reason: "Something went wrong" }));
      } else {
        const inserted = (data || []).map(toBooking);
        succeeded.push(...inserted);
        const byMonth = inserted.reduce((groups, booking) => {
          const month = booking.checkIn.slice(0, 7);
          groups[month] = [...(groups[month] || []), booking];
          return groups;
        }, {});
        Object.entries(byMonth).forEach(([month, monthBookings]) => {
          fetchCache.current.delete(`${propertyId}-${month}`);
          statsCache.current.clear();
          invalidateAllPropertiesMonth(month);
          if (propertyId === activePropertyIdRef.current) {
            setMonthBookings(month, (current) => [...current, ...monthBookings]);
          }
        });
      }
      onProgress?.({ completed: Math.min(start + batch.length, records.length), total: records.length });
    }
    return { succeeded, failed, insertedCount: succeeded.length };
  }

  async function saveBooking(booking) {
    if (!activePropertyId) {
      reportError(new Error("No active property"));
      return null;
    }
    const conflict = isNetworkAvailable()
      ? await findBookingConflict(booking)
      : bookings.find((item) => item.id !== booking.id && item.bookingStatus !== "cancelled" && booking.checkIn < item.checkOut && booking.checkOut > item.checkIn) || null;
    if (conflict) return { conflict };
    const month = booking.checkIn.slice(0, 7);
    const hasExistingId = Boolean(booking.id);
    const localDraft = String(booking.id || "").startsWith("booking-");
    const existsLocally = hasExistingId && !localDraft;
    const persisted = Boolean(existsLocally && !String(booking.id).startsWith("temp-"));
    const originalMonth = existsLocally
      ? Object.keys(bookingsByMonth).find((key) => bookingsByMonth[key]?.some((item) => item.id === booking.id))
      : null;
    const affectedMonths = [...new Set([originalMonth, month].filter(Boolean))];
    const previousByMonth = Object.fromEntries(affectedMonths.map((key) => [key, bookingsByMonth[key] || []]));
    const optimistic = {
      ...booking,
      id: existsLocally ? booking.id : (isNetworkAvailable() ? (booking.id || `booking-${Date.now()}`) : `temp-${createQueueId()}`),
      pendingSync: !isNetworkAvailable() || booking.pendingSync
    };

    setBookingsByMonth((current) => {
      const next = { ...current };
      if (originalMonth) {
        next[originalMonth] = (next[originalMonth] || []).filter((item) => item.id !== optimistic.id);
      }
      const target = (next[month] || []).filter((item) => item.id !== optimistic.id);
      next[month] = [...target, optimistic];
      return next;
    });
    affectedMonths.forEach((key) => {
      updateMonthCache(key, (cached) => {
        const withoutBooking = cached.bookings.filter((item) => item.id !== optimistic.id);
        return { ...cached, bookings: key === month ? [...withoutBooking, optimistic] : withoutBooking };
      });
    });

    if (!isNetworkAvailable()) {
      enqueueSync(existsLocally ? "updateBooking" : "addBooking", existsLocally
        ? { booking: optimistic, propertyId: activePropertyId, originalMonth }
        : { booking: optimistic, propertyId: activePropertyId, tempId: optimistic.id });
      return optimistic;
    }

    const payload = persisted
      ? bookingChanges(optimistic)
      : fromBooking(optimistic, userId, activePropertyId);
    const query = persisted
      ? supabase.from("bookings").update(payload).eq("user_id", userId).eq("property_id", activePropertyId).eq("id", optimistic.id).select("*").single()
      : supabase.from("bookings").insert(payload).select("*").single();
    const { data, error: mutationError } = await query;
    if (mutationError) {
      setBookingsByMonth((current) => {
        const next = { ...current };
        affectedMonths.forEach((key) => {
          next[key] = previousByMonth[key];
        });
        return next;
      });
      affectedMonths.forEach((key) => {
        updateMonthCache(key, (cached) => ({ ...cached, bookings: previousByMonth[key] }));
      });
      if (mutationError.code === "23P01" || mutationError.message?.includes("no_overlapping_bookings")) {
        const databaseConflict = await findBookingConflict(booking);
        return { conflict: databaseConflict || { guestName: "another guest", checkIn: booking.checkIn, checkOut: booking.checkOut } };
      }
      reportError(mutationError);
      return null;
    }
    const saved = toBooking(data);
    setMonthBookings(month, (current) => current.map((item) => item.id === optimistic.id ? saved : item));
    updateMonthCache(month, (cached) => ({ ...cached, bookings: cached.bookings.map((item) => item.id === optimistic.id ? saved : item) }));
    return saved;
  }

  function finalizeBookingDeletion(id, month) {
    if (!month) return;
    setMonthBookings(month, (current) => current.filter((booking) => booking.id !== id));
    updateMonthCache(month, (cached) => ({ ...cached, bookings: cached.bookings.filter((booking) => booking.id !== id) }));
  }

  async function deleteBooking(id, { deferLocalRemoval = false } = {}) {
    const month = Object.keys(bookingsByMonth).find((key) => bookingsByMonth[key]?.some((booking) => booking.id === id));
    if (!month) return false;
    const previous = bookingsByMonth[month] || [];
    if (!deferLocalRemoval) finalizeBookingDeletion(id, month);
    if (!isNetworkAvailable()) {
      enqueueSync("deleteBooking", { id, propertyId: activePropertyId, month });
      return { month };
    }
    const { error: mutationError } = await supabase.from("bookings").delete().eq("user_id", userId).eq("property_id", activePropertyId).eq("id", id);
    if (mutationError) {
      if (!deferLocalRemoval) {
        setBookingsByMonth((current) => ({ ...current, [month]: previous }));
        updateMonthCache(month, (cached) => ({ ...cached, bookings: previous }));
      }
      reportError(mutationError);
      return false;
    }
    return { month };
  }

  async function updateMonthlyCosts(month, costs) {
    if (!activePropertyId) {
      reportError(new Error("No active property"));
      return false;
    }
    const previous = costsByMonth[month];
    const next = {
      month,
      property_id: activePropertyId,
      user_id: userId,
      cost_1: Number(costs.cost_1 ?? costs.rent ?? previous?.cost_1 ?? 0),
      cost_2: Number(costs.cost_2 ?? costs.cleaning ?? previous?.cost_2 ?? 0),
      pendingSync: !isNetworkAvailable()
    };
    setCostsByMonth((current) => ({ ...current, [month]: next }));
    updateMonthCache(month, (cached) => ({ ...cached, costs: next }));
    if (!isNetworkAvailable()) {
      enqueueSync("updateMonthlyCosts", { month, propertyId: activePropertyId, costs: { ...next, pendingSync: undefined } });
      return true;
    }
    const { data, error: mutationError } = await supabase
      .from("monthly_costs")
      .upsert(next, { onConflict: "property_id,month" })
      .select("*")
      .single();
    if (mutationError) {
      setCostsByMonth((current) => ({ ...current, [month]: previous }));
      updateMonthCache(month, (cached) => ({ ...cached, costs: previous }));
      reportError(mutationError);
      return false;
    }
    setCostsByMonth((current) => ({ ...current, [month]: data }));
    updateMonthCache(month, (cached) => ({ ...cached, costs: data }));
    return true;
  }

  async function updateFixedCost(month, field, amount) {
    const current = costsByMonth[month] || { cost_1: 0, cost_2: 0 };
    const key = field === "rent" ? "cost_1" : "cost_2";
    const nextValue = Number(amount);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      reportError(new Error("Invalid cost amount"));
      return false;
    }
    return updateMonthlyCosts(month, { ...current, [key]: nextValue });
  }

  async function addExpense(month, expense) {
    if (!activePropertyId) {
      reportError(new Error("No active property"));
      return null;
    }
    const optimistic = {
      ...expense,
      id: isNetworkAvailable() ? (expense.id || `expense-${Date.now()}`) : `temp-${createQueueId()}`,
      pendingSync: !isNetworkAvailable()
    };
    const previous = expensesByMonth[month] || [];
    setMonthExpenses(month, (current) => [optimistic, ...current]);
    updateMonthCache(month, (cached) => ({ ...cached, expenses: [optimistic, ...cached.expenses] }));
    const date = expense.date || new Date().toISOString().slice(0, 10);
    const time = expense.createdAt?.slice(11, 19) || new Date().toTimeString().slice(0, 8);
    const row = {
      property_id: activePropertyId,
      user_id: userId,
      month,
      description: expense.description,
      amount: Number(expense.amount || 0),
      expense_date: date,
      expense_time: time
    };
    if (!isNetworkAvailable()) {
      enqueueSync("addExpense", { row, propertyId: activePropertyId, month, tempId: optimistic.id });
      return optimistic;
    }
    const { data, error: mutationError } = await supabase.from("expenses").insert(row).select("*").single();
    if (mutationError) {
      setExpensesByMonth((current) => ({ ...current, [month]: previous }));
      updateMonthCache(month, (cached) => ({ ...cached, expenses: previous }));
      reportError(mutationError);
      return null;
    }
    const saved = toExpense(data);
    setMonthExpenses(month, (current) => current.map((item) => item.id === optimistic.id ? saved : item));
    updateMonthCache(month, (cached) => ({ ...cached, expenses: cached.expenses.map((item) => item.id === optimistic.id ? saved : item) }));
    return saved;
  }

  async function updateExpense(month, expense) {
    const previous = expensesByMonth[month] || [];
    const optimistic = { ...expense, pendingSync: !isNetworkAvailable() || expense.pendingSync };
    setMonthExpenses(month, (current) => current.map((item) => item.id === expense.id ? optimistic : item));
    updateMonthCache(month, (cached) => ({ ...cached, expenses: cached.expenses.map((item) => item.id === expense.id ? optimistic : item) }));
    const changes = {
      description: expense.description,
      amount: Number(expense.amount || 0),
      expense_date: expense.date,
      expense_time: expense.createdAt?.slice(11, 19) || "00:00:00"
    };
    if (!isNetworkAvailable()) {
      enqueueSync("updateExpense", { id: expense.id, propertyId: activePropertyId, month, changes });
      return true;
    }
    const { error: mutationError } = await supabase.from("expenses").update(changes).eq("user_id", userId).eq("property_id", activePropertyId).eq("id", expense.id);
    if (mutationError) {
      setExpensesByMonth((current) => ({ ...current, [month]: previous }));
      updateMonthCache(month, (cached) => ({ ...cached, expenses: previous }));
      reportError(mutationError);
      return false;
    }
    return true;
  }

  async function deleteExpense(month, id) {
    const previous = expensesByMonth[month] || [];
    setMonthExpenses(month, (current) => current.filter((expense) => expense.id !== id));
    updateMonthCache(month, (cached) => ({ ...cached, expenses: cached.expenses.filter((expense) => expense.id !== id) }));
    if (!isNetworkAvailable()) {
      enqueueSync("deleteExpense", { id, propertyId: activePropertyId, month });
      return true;
    }
    const { error: mutationError } = await supabase.from("expenses").delete().eq("user_id", userId).eq("property_id", activePropertyId).eq("id", id);
    if (mutationError) {
      setExpensesByMonth((current) => ({ ...current, [month]: previous }));
      updateMonthCache(month, (cached) => ({ ...cached, expenses: previous }));
      reportError(mutationError);
      return false;
    }
    return true;
  }

  async function addProperty(name, { activate = true } = {}) {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      reportError(new Error("Invalid property name"));
      return null;
    }
    const { data, error: insertError } = await supabase.from("properties").insert({ user_id: userId, name: trimmedName }).select("*").single();
    if (insertError) {
      reportError(insertError);
      return null;
    }
    setProperties((current) => [...current, data]);
    allPropertiesCache.current.clear();
    setAllPropertiesMonths({});
    setAllPropertiesInitializedMonths(new Set());
    if (activate) setActivePropertyId(data.id);
    return data;
  }

  async function renameProperty(id, name) {
    const trimmedName = name.trim();
    if (!trimmedName || trimmedName.length > 100) {
      reportError(new Error("Invalid property name"));
      return false;
    }
    const previous = properties;
    setProperties((current) => current.map((property) => property.id === id ? { ...property, name: trimmedName } : property));
    allPropertiesCache.current.clear();
    setAllPropertiesMonths({});
    setAllPropertiesInitializedMonths(new Set());
    const { error: updateError } = await supabase.from("properties").update({ name: trimmedName }).eq("user_id", userId).eq("id", id);
    if (updateError) {
      setProperties(previous);
      reportError(updateError);
      return false;
    }
    return true;
  }

  async function deleteProperty(id, { switchToRemaining = true, deferLocalRemoval = false } = {}) {
    if (properties.length <= 1) {
      reportError(new Error("You need at least one property"));
      return false;
    }
    const next = properties.filter((property) => property.id !== id);
    const { error: deleteError } = await supabase.from("properties").delete().eq("user_id", userId).eq("id", id);
    if (deleteError) {
      reportError(deleteError);
      return false;
    }
    if (!deferLocalRemoval) setProperties(next);
    allPropertiesCache.current.clear();
    setAllPropertiesMonths({});
    setAllPropertiesInitializedMonths(new Set());
    if (switchToRemaining) setActivePropertyId(next[0].id);
    return { nextPropertyId: next[0].id };
  }

  function finalizePropertyDeletion(id) {
    setProperties((current) => current.filter((property) => property.id !== id));
    allPropertiesCache.current.clear();
    setAllPropertiesMonths({});
    setAllPropertiesInitializedMonths(new Set());
  }

  async function updateUserSettings(settings) {
    const previous = userSettings;
    const next = { ...userSettings, ...settings };
    setUserSettings(next);
    const { error: updateError } = await supabase.from("user_settings").update(settings).eq("user_id", userId);
    if (updateError) {
      setUserSettings(previous);
      reportError(updateError);
      return false;
    }
    if (settings.currency) localStorage.setItem("hostrack-currency", settings.currency);
    if (settings.theme) localStorage.setItem("hostrack-theme", settings.theme);
    return true;
  }

  async function deleteUserData() {
    if (!userId) return false;
    const { error: propertiesError } = await supabase
      .from("properties")
      .delete()
      .eq("user_id", userId);
    if (propertiesError) {
      reportError(propertiesError);
      return false;
    }
    const { error: settingsError } = await supabase
      .from("user_settings")
      .delete()
      .eq("user_id", userId);
    if (settingsError) {
      reportError(settingsError);
      return false;
    }
    localStorage.removeItem("activePropertyId");
    setProperties([]);
    setActivePropertyIdState("");
    setBookingsByMonth({});
    setCostsByMonth({});
    setExpensesByMonth({});
    setStatsMonths([]);
    fetchCache.current.clear();
    statsCache.current.clear();
    initializedKeys.current.clear();
    return true;
  }

  function isMonthLoading(month) {
    return activePropertyId ? loadingKeys.has(`${activePropertyId}-${month}`) : false;
  }

  function isMonthInitialized(month) {
    return activePropertyId ? initializedKeys.current.has(`${activePropertyId}-${month}`) : false;
  }

  function isMonthOfflineUnavailable(month) {
    return activePropertyId ? offlineUnavailableKeys.has(`${activePropertyId}-${month}`) : false;
  }

  async function retryMonth(month) {
    if (!isNetworkAvailable() || !activePropertyId || !month) return false;
    const key = `${activePropertyId}-${month}`;
    fetchCache.current.delete(key);
    initializedKeys.current.delete(key);
    persistDataCache();
    return Boolean(await fetchMonth(activePropertyId, month));
  }

  async function refreshMonth(month) {
    if (!isNetworkAvailable() || !activePropertyId || !month) return false;
    return Boolean(await fetchMonth(activePropertyId, month, { force: true, background: true }));
  }

  function refreshStatsMonths() {
    return fetchStatsMonths({ force: true, background: true });
  }

  function refreshAllPropertiesMonth(month) {
    return fetchAllPropertiesMonth(month, { force: true, background: true });
  }

  function isAllPropertiesMonthLoading(month) {
    return allPropertiesLoadingMonths.has(month);
  }

  function isAllPropertiesMonthInitialized(month) {
    return allPropertiesInitializedMonths.has(month);
  }

  return {
    properties,
    baseInitialized,
    refreshProperties: fetchPropertiesAndSettings,
    activeProperty,
    activePropertyId,
    setActivePropertyId,
    userSettings,
    costLabels,
    bookings,
    bookingsByMonth,
    monthlyStats,
    statsMonths,
    statsLoading,
    statsInitialized,
    allPropertiesMonths,
    fetchAllPropertiesMonth,
    isAllPropertiesMonthLoading,
    isAllPropertiesMonthInitialized,
    isMonthLoading,
    isMonthInitialized,
    isMonthOfflineUnavailable,
    retryMonth,
    refreshMonth,
    isOnline,
    isSyncing,
    syncQueue,
    syncFailures,
    discardSyncOperation,
    dismissSyncFailures,
    retrySyncOperation,
    processSyncQueue,
    error,
    setError,
    addProperty,
    renameProperty,
    deleteProperty,
    finalizePropertyDeletion,
    updateUserSettings,
    deleteUserData,
    fetchStatsMonths,
    refreshStatsMonths,
    refreshAllPropertiesMonth,
    checkBookingConflict,
    checkImportConflicts,
    importBookings,
    saveBooking,
    deleteBooking,
    finalizeBookingDeletion,
    updateFixedCost,
    addExpense,
    updateExpense,
    deleteExpense
  };
}
