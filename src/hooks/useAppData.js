import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabase";

const defaultSettings = {
  currency: "EUR",
  currency_symbol: "€",
  cost_label_1: "Rent",
  cost_label_2: "Cleaning"
};

function toBooking(row) {
  return {
    id: row.id,
    guestName: row.guest_name,
    checkIn: row.check_in,
    checkOut: row.check_out,
    nights: row.nights,
    revenue: Number(row.revenue || 0),
    rating: row.rating,
    status: row.status === "paid" ? "Paid" : "Unpaid"
  };
}

function fromBooking(booking, userId, propertyId) {
  return {
    id: String(booking.id).startsWith("booking-") ? undefined : booking.id,
    property_id: propertyId,
    user_id: userId,
    guest_name: booking.guestName,
    check_in: booking.checkIn,
    check_out: booking.checkOut,
    nights: booking.nights,
    revenue: Number(booking.revenue || 0),
    rating: booking.rating,
    status: booking.status === "Paid" ? "paid" : "unpaid"
  };
}

function monthDays(month) {
  const [year, index] = month.split("-").map(Number);
  return new Date(year, index, 0).getDate();
}

function blankMonth(month) {
  return {
    month,
    rent: 0,
    cleaning: 0,
    randomExpenses: [],
    expenses: 0,
    totalRevenue: 0,
    occupancyNights: 0,
    occupancyRate: 0,
    netRevenue: 0
  };
}

function buildSummary(month, bookings, costs, expenses) {
  const paidBookings = bookings.filter((booking) => booking.status === "Paid");
  const totalRevenue = paidBookings.reduce((total, booking) => total + Number(booking.revenue || 0), 0);
  const occupancyNights = bookings.reduce((total, booking) => total + Number(booking.nights || 0), 0);
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
    occupancyNights,
    occupancyRate: Math.min(100, Math.round((occupancyNights / monthDays(month)) * 100)),
    netRevenue: totalRevenue - rent - cleaning - expenseTotal
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

export function useAppData(user, months = []) {
  const userId = user?.id;
  const [properties, setProperties] = useState([]);
  const [activePropertyId, setActivePropertyIdState] = useState(() => localStorage.getItem("activePropertyId") || "");
  const [userSettings, setUserSettings] = useState(defaultSettings);
  const [bookingsByMonth, setBookingsByMonth] = useState({});
  const [costsByMonth, setCostsByMonth] = useState({});
  const [expensesByMonth, setExpensesByMonth] = useState({});
  const [statsMonths, setStatsMonths] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const activeProperty = useMemo(() => properties.find((property) => property.id === activePropertyId) || properties[0] || null, [activePropertyId, properties]);
  const costLabels = useMemo(() => ({
    rent: userSettings.cost_label_1 || "Rent",
    cleaning: userSettings.cost_label_2 || "Cleaning"
  }), [userSettings.cost_label_1, userSettings.cost_label_2]);

  const monthKey = months.filter(Boolean).join("|");
  const loadedMonths = useMemo(() => [...new Set(monthKey.split("|").filter(Boolean))], [monthKey]);

  useEffect(() => {
    if (userId) return;
    setProperties([]);
    setActivePropertyIdState("");
    setUserSettings(defaultSettings);
    setBookingsByMonth({});
    setCostsByMonth({});
    setExpensesByMonth({});
    setStatsMonths([]);
    setError(null);
    setIsLoading(false);
  }, [userId]);

  function reportError(nextError) {
    logError(nextError);
    setError(nextError);
  }

  function setActivePropertyId(id) {
    localStorage.setItem("activePropertyId", id);
    setActivePropertyIdState(id);
  }

  const fetchPropertiesAndSettings = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    const [{ data: propertyRows, error: propertiesError }, { data: settingsRow, error: settingsError }] = await Promise.all([
      supabase.from("properties").select("*").eq("user_id", userId).order("created_at", { ascending: true }),
      supabase.from("user_settings").select("*").eq("user_id", userId).maybeSingle()
    ]);

    if (propertiesError || settingsError) {
      reportError(propertiesError || settingsError);
      setIsLoading(false);
      return;
    }

    setProperties(propertyRows || []);
    setUserSettings(settingsRow || defaultSettings);
    const saved = localStorage.getItem("activePropertyId");
    const nextActive = propertyRows?.some((property) => property.id === saved) ? saved : propertyRows?.[0]?.id || "";
    if (nextActive) setActivePropertyId(nextActive);
    setIsLoading(false);
  }, [userId]);

  const fetchMonths = useCallback(async (propertyId = activePropertyId, targetMonths = loadedMonths) => {
    if (!userId || !propertyId || !targetMonths.length) return;
    setIsLoading(true);
    setError(null);
    const starts = targetMonths.map((month) => `${month}-01`).sort();
    const ends = targetMonths.map((month) => `${month}-${String(monthDays(month)).padStart(2, "0")}`).sort();
    const min = starts[0];
    const max = ends.at(-1);
    const [bookingsResult, costsResult, expensesResult] = await Promise.all([
      supabase.from("bookings").select("*").eq("user_id", userId).eq("property_id", propertyId).gte("check_in", min).lte("check_in", max).order("check_in", { ascending: true }),
      supabase.from("monthly_costs").select("*").eq("user_id", userId).eq("property_id", propertyId).in("month", targetMonths),
      supabase.from("expenses").select("*").eq("user_id", userId).eq("property_id", propertyId).in("month", targetMonths).order("created_at", { ascending: false })
    ]);

    if (bookingsResult.error || costsResult.error || expensesResult.error) {
      reportError(bookingsResult.error || costsResult.error || expensesResult.error);
      setIsLoading(false);
      return;
    }

    const nextBookings = {};
    const nextCosts = {};
    const nextExpenses = {};
    targetMonths.forEach((month) => {
      nextBookings[month] = (bookingsResult.data || []).filter((booking) => booking.check_in?.startsWith(month)).map(toBooking);
      nextCosts[month] = (costsResult.data || []).find((cost) => cost.month === month) || { month, cost_1: 0, cost_2: 0 };
      nextExpenses[month] = (expensesResult.data || []).filter((expense) => expense.month === month).map(toExpense);
    });
    setBookingsByMonth((current) => ({ ...current, ...nextBookings }));
    setCostsByMonth((current) => ({ ...current, ...nextCosts }));
    setExpensesByMonth((current) => ({ ...current, ...nextExpenses }));
    setIsLoading(false);
  }, [activePropertyId, loadedMonths, userId]);

  useEffect(() => {
    setBookingsByMonth({});
    setCostsByMonth({});
    setExpensesByMonth({});
    setStatsMonths([]);
  }, [activePropertyId]);

  useEffect(() => {
    fetchPropertiesAndSettings();
  }, [fetchPropertiesAndSettings]);

  useEffect(() => {
    fetchMonths();
  }, [fetchMonths]);

  const bookings = useMemo(() => Object.values(bookingsByMonth).flat(), [bookingsByMonth]);
  const monthlyCosts = useMemo(() => Object.values(costsByMonth), [costsByMonth]);
  const expenses = useMemo(() => Object.values(expensesByMonth).flat(), [expensesByMonth]);
  const monthlyStats = useMemo(() => loadedMonths.map((month) => buildSummary(month, bookingsByMonth[month] || [], costsByMonth[month], expensesByMonth[month] || [])), [bookingsByMonth, costsByMonth, expensesByMonth, loadedMonths]);

  async function fetchStatsMonths() {
    if (!userId || !activePropertyId) return;
    const [bookingsResult, costsResult, expensesResult] = await Promise.all([
      supabase.from("bookings").select("*").eq("user_id", userId).eq("property_id", activePropertyId),
      supabase.from("monthly_costs").select("*").eq("user_id", userId).eq("property_id", activePropertyId),
      supabase.from("expenses").select("*").eq("user_id", userId).eq("property_id", activePropertyId)
    ]);
    if (bookingsResult.error || costsResult.error || expensesResult.error) {
      reportError(bookingsResult.error || costsResult.error || expensesResult.error);
      return;
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
    setStatsMonths(stats);
  }

  function setMonthBookings(month, updater) {
    setBookingsByMonth((current) => ({ ...current, [month]: updater(current[month] || []) }));
  }

  function setMonthExpenses(month, updater) {
    setExpensesByMonth((current) => ({ ...current, [month]: updater(current[month] || []) }));
  }

  async function saveBooking(booking) {
    if (!activePropertyId) {
      reportError(new Error("No active property"));
      return null;
    }
    const month = booking.checkIn.slice(0, 7);
    const previous = bookingsByMonth[month] || [];
    const optimistic = { ...booking, id: booking.id || `booking-${Date.now()}` };
    const exists = previous.some((item) => item.id === optimistic.id);
    setMonthBookings(month, (current) => exists ? current.map((item) => item.id === optimistic.id ? optimistic : item) : [...current, optimistic]);
    const payload = fromBooking(optimistic, userId, activePropertyId);
    const query = exists && !String(optimistic.id).startsWith("booking-")
      ? supabase.from("bookings").update(payload).eq("user_id", userId).eq("property_id", activePropertyId).eq("id", optimistic.id).select("*").single()
      : supabase.from("bookings").insert(payload).select("*").single();
    const { data, error: mutationError } = await query;
    if (mutationError) {
      setBookingsByMonth((current) => ({ ...current, [month]: previous }));
      reportError(mutationError);
      return null;
    }
    setMonthBookings(month, (current) => current.map((item) => item.id === optimistic.id ? toBooking(data) : item));
    return toBooking(data);
  }

  async function updateBooking(booking) {
    return saveBooking(booking);
  }

  async function addBooking(booking) {
    return saveBooking(booking);
  }

  async function deleteBooking(id) {
    const month = Object.keys(bookingsByMonth).find((key) => bookingsByMonth[key]?.some((booking) => booking.id === id));
    if (!month) return;
    const previous = bookingsByMonth[month] || [];
    setMonthBookings(month, (current) => current.filter((booking) => booking.id !== id));
    const { error: mutationError } = await supabase.from("bookings").delete().eq("user_id", userId).eq("property_id", activePropertyId).eq("id", id);
    if (mutationError) {
      setBookingsByMonth((current) => ({ ...current, [month]: previous }));
      reportError(mutationError);
    }
  }

  async function updateMonthlyCosts(month, costs) {
    if (!activePropertyId) {
      reportError(new Error("No active property"));
      return;
    }
    const previous = costsByMonth[month];
    const next = {
      month,
      property_id: activePropertyId,
      user_id: userId,
      cost_1: Number(costs.cost_1 ?? costs.rent ?? previous?.cost_1 ?? 0),
      cost_2: Number(costs.cost_2 ?? costs.cleaning ?? previous?.cost_2 ?? 0)
    };
    setCostsByMonth((current) => ({ ...current, [month]: next }));
    const { error: mutationError } = await supabase.from("monthly_costs").upsert(next, { onConflict: "property_id,month" });
    if (mutationError) {
      setCostsByMonth((current) => ({ ...current, [month]: previous }));
      reportError(mutationError);
    }
  }

  async function addFixedCost(month, field, amount) {
    const current = costsByMonth[month] || { cost_1: 0, cost_2: 0 };
    const key = field === "rent" ? "cost_1" : "cost_2";
    const nextValue = Number(current[key] || 0) + Number(amount);
    if (!Number.isFinite(nextValue) || nextValue < 0) {
      reportError(new Error("Invalid cost amount"));
      return;
    }
    await updateMonthlyCosts(month, { ...current, [key]: nextValue });
  }

  async function addExpense(month, expense) {
    if (!activePropertyId) {
      reportError(new Error("No active property"));
      return null;
    }
    const optimistic = { ...expense, id: expense.id || `expense-${Date.now()}` };
    const previous = expensesByMonth[month] || [];
    setMonthExpenses(month, (current) => [optimistic, ...current]);
    const date = expense.date || new Date().toISOString().slice(0, 10);
    const time = expense.createdAt?.slice(11, 19) || new Date().toTimeString().slice(0, 8);
    const { data, error: mutationError } = await supabase.from("expenses").insert({
      property_id: activePropertyId,
      user_id: userId,
      month,
      description: expense.description,
      amount: Number(expense.amount || 0),
      expense_date: date,
      expense_time: time
    }).select("*").single();
    if (mutationError) {
      setExpensesByMonth((current) => ({ ...current, [month]: previous }));
      reportError(mutationError);
      return null;
    }
    setMonthExpenses(month, (current) => current.map((item) => item.id === optimistic.id ? toExpense(data) : item));
    return toExpense(data);
  }

  async function updateExpense(month, expense) {
    const previous = expensesByMonth[month] || [];
    setMonthExpenses(month, (current) => current.map((item) => item.id === expense.id ? expense : item));
    const { error: mutationError } = await supabase.from("expenses").update({
      description: expense.description,
      amount: Number(expense.amount || 0),
      expense_date: expense.date,
      expense_time: expense.createdAt?.slice(11, 19) || "00:00:00"
    }).eq("user_id", userId).eq("property_id", activePropertyId).eq("id", expense.id);
    if (mutationError) {
      setExpensesByMonth((current) => ({ ...current, [month]: previous }));
      reportError(mutationError);
    }
  }

  async function deleteExpense(month, id) {
    const previous = expensesByMonth[month] || [];
    setMonthExpenses(month, (current) => current.filter((expense) => expense.id !== id));
    const { error: mutationError } = await supabase.from("expenses").delete().eq("user_id", userId).eq("property_id", activePropertyId).eq("id", id);
    if (mutationError) {
      setExpensesByMonth((current) => ({ ...current, [month]: previous }));
      reportError(mutationError);
    }
  }

  async function addProperty(name) {
    if (name.trim().length > 100) {
      reportError(new Error("Invalid property name"));
      return null;
    }
    const optimistic = { id: `property-${Date.now()}`, user_id: userId, name };
    setProperties((current) => [...current, optimistic]);
    setActivePropertyId(optimistic.id);
    const { data, error: insertError } = await supabase.from("properties").insert({ user_id: userId, name }).select("*").single();
    if (insertError) {
      setProperties((current) => current.filter((property) => property.id !== optimistic.id));
      reportError(insertError);
      return null;
    }
    setProperties((current) => current.map((property) => property.id === optimistic.id ? data : property));
    setActivePropertyId(data.id);
    return data;
  }

  async function renameProperty(id, name) {
    const previous = properties;
    setProperties((current) => current.map((property) => property.id === id ? { ...property, name } : property));
    const { error: updateError } = await supabase.from("properties").update({ name }).eq("user_id", userId).eq("id", id);
    if (updateError) {
      setProperties(previous);
      reportError(updateError);
    }
  }

  async function updateProperty(id, updates) {
    const name = typeof updates === "string" ? updates : updates?.name;
    if (!name) return null;
    await renameProperty(id, name);
    return properties.find((property) => property.id === id) || null;
  }

  async function deleteProperty(id) {
    if (properties.length <= 1) {
      reportError(new Error("You need at least one property"));
      return false;
    }
    const previous = properties;
    const next = properties.filter((property) => property.id !== id);
    setProperties(next);
    if (activePropertyId === id) setActivePropertyId(next[0].id);
    const { error: deleteError } = await supabase.from("properties").delete().eq("user_id", userId).eq("id", id);
    if (deleteError) {
      setProperties(previous);
      reportError(deleteError);
      return false;
    }
    return true;
  }

  async function updateUserSettings(settings) {
    const previous = userSettings;
    const next = { ...userSettings, ...settings };
    setUserSettings(next);
    const { error: updateError } = await supabase.from("user_settings").update(settings).eq("user_id", userId);
    if (updateError) {
      setUserSettings(previous);
      reportError(updateError);
    }
  }

  return {
    properties,
    activeProperty,
    activePropertyId,
    setActivePropertyId,
    userSettings,
    monthlyCosts,
    expenses,
    costLabels,
    bookings,
    bookingsByMonth,
    expensesByMonth,
    costsByMonth,
    monthlyStats,
    statsMonths,
    isLoading,
    error,
    setError,
    fetchMonths,
    addProperty,
    renameProperty,
    updateProperty,
    deleteProperty,
    updateUserSettings,
    fetchStatsMonths,
    addBooking,
    saveBooking,
    updateBooking,
    deleteBooking,
    updateMonthlyCosts,
    addFixedCost,
    addExpense,
    updateExpense,
    deleteExpense
  };
}
