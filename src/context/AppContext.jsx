import { createContext, useContext, useMemo, useState } from "react";
import { initialBookings, monthlyStats } from "../data/mockData";

const AppContext = createContext(null);

const currencies = {
  USD: { code: "USD", symbol: "$", label: "$ USD" },
  CAD: { code: "CAD", symbol: "$", label: "$ CAD" },
  GBP: { code: "GBP", symbol: "£", label: "£ GBP" },
  EUR: { code: "EUR", symbol: "€", label: "€ EUR" }
};

function randomExpenseTotal(randomExpenses = []) {
  return randomExpenses.reduce((total, expense) => total + Number(expense.amount || 0), 0);
}

function recalculateSummary(summary) {
  const expenses = randomExpenseTotal(summary.randomExpenses);
  return {
    ...summary,
    expenses,
    netRevenue: summary.totalRevenue - summary.rent - summary.cleaning - expenses
  };
}

function blankSummary(month) {
  return {
    month,
    rent: 2150,
    cleaning: 0,
    randomExpenses: [],
    expenses: 0,
    totalRevenue: 0,
    occupancyNights: 0,
    occupancyRate: 0,
    netRevenue: -2150
  };
}

export function AppProvider({ children }) {
  const [bookings, setBookings] = useState(initialBookings);
  const [stats, setStats] = useState(monthlyStats);
  const [revenueAnimation, setRevenueAnimation] = useState(null);
  const [currencyCode, setCurrencyCode] = useState(() => localStorage.getItem("hostio-currency") || "USD");
  const [costLabels, setCostLabels] = useState(() => {
    const saved = localStorage.getItem("hostio-cost-labels");
    return saved ? JSON.parse(saved) : { rent: "Rent", cleaning: "Cleaning" };
  });
  const currency = currencies[currencyCode];

  function updateCurrency(code) {
    localStorage.setItem("hostio-currency", code);
    setCurrencyCode(code);
  }

  function saveBooking(booking) {
    setBookings((current) => {
      const exists = current.some((item) => item.id === booking.id);
      return exists ? current.map((item) => item.id === booking.id ? booking : item) : [...current, booking];
    });
  }

  function deleteBooking(id) {
    setBookings((current) => current.filter((booking) => booking.id !== id));
  }

  function toggleBookingStatus(id) {
    const booking = bookings.find((item) => item.id === id);
    if (!booking) return;
    const direction = booking.status === "Paid" ? "down" : "up";
    const delta = direction === "up" ? booking.revenue : -booking.revenue;
    const month = booking.checkIn.slice(0, 7);
    const summary = stats.find((item) => item.month === month);
    setStats((summaries) => summaries.map((item) => item.month === month ? {
      ...item,
      totalRevenue: item.totalRevenue + delta,
      netRevenue: item.netRevenue + delta
    } : item));
    setRevenueAnimation({
      month,
      direction,
      id: Date.now(),
      previousNetRevenue: summary?.netRevenue,
      nextNetRevenue: summary ? summary.netRevenue + delta : undefined,
      previousTotalRevenue: summary?.totalRevenue,
      nextTotalRevenue: summary ? summary.totalRevenue + delta : undefined
    });
    setBookings((current) => current.map((item) => item.id === id ? { ...item, status: direction === "up" ? "Paid" : "Unpaid" } : item));
  }

  function setNetAnimation(month, previousNet, nextNet) {
    if (nextNet === previousNet) return;
    setRevenueAnimation({ month, direction: nextNet > previousNet ? "up" : "down", id: Date.now(), previousNetRevenue: previousNet, nextNetRevenue: nextNet });
  }

  function updateMonthlyCosts(month, costs) {
    setStats((current) => current.map((item) => {
      if (item.month !== month) return item;
      const randomExpenses = Number(costs.expenses)
        ? [{ id: `${month}-manual-expenses`, description: "Expenses", amount: Number(costs.expenses) }]
        : [];
      const next = recalculateSummary({ ...item, rent: Number(costs.rent), cleaning: Number(costs.cleaning), randomExpenses });
      setNetAnimation(month, item.netRevenue, next.netRevenue);
      return next;
    }));
  }

  function updateFixedCost(month, field, amount) {
    setStats((current) => {
      const source = current.some((item) => item.month === month) ? current : [...current, blankSummary(month)].sort((a, b) => a.month.localeCompare(b.month));
      return source.map((item) => {
      if (item.month !== month) return item;
      const next = recalculateSummary({ ...item, [field]: Number(item[field] || 0) + Number(amount) });
      setNetAnimation(month, item.netRevenue, next.netRevenue);
      return next;
      });
    });
  }

  function updateCostLabel(field, label) {
    setCostLabels((current) => {
      const next = { ...current, [field]: label };
      localStorage.setItem("hostio-cost-labels", JSON.stringify(next));
      return next;
    });
  }

  function addRandomExpense(month, expense) {
    setStats((current) => {
      const source = current.some((item) => item.month === month) ? current : [...current, blankSummary(month)].sort((a, b) => a.month.localeCompare(b.month));
      return source.map((item) => {
      if (item.month !== month) return item;
      const nextExpense = {
        id: expense.id || `${month}-expense-${Date.now()}`,
        description: expense.description,
        amount: Number(expense.amount),
        date: expense.date,
        createdAt: expense.createdAt || new Date().toISOString()
      };
      const next = recalculateSummary({ ...item, randomExpenses: [...(item.randomExpenses || []), nextExpense] });
      setNetAnimation(month, item.netRevenue, next.netRevenue);
      return next;
      });
    });
  }

  function updateRandomExpense(month, expense) {
    setStats((current) => current.map((item) => {
      if (item.month !== month) return item;
      const next = recalculateSummary({
        ...item,
        randomExpenses: (item.randomExpenses || []).map((entry) => entry.id === expense.id ? {
          ...entry,
          description: expense.description,
          amount: Number(expense.amount),
          date: expense.date,
          createdAt: expense.createdAt || entry.createdAt
        } : entry)
      });
      setNetAnimation(month, item.netRevenue, next.netRevenue);
      return next;
    }));
  }

  function deleteRandomExpense(month, id) {
    setStats((current) => current.map((item) => {
      if (item.month !== month) return item;
      const next = recalculateSummary({ ...item, randomExpenses: (item.randomExpenses || []).filter((expense) => expense.id !== id) });
      setNetAnimation(month, item.netRevenue, next.netRevenue);
      return next;
    }));
  }

  const formatCurrency = useMemo(() => (amount) => `${Number(amount) < 0 ? "-" : ""}${currency.symbol}${Math.abs(Number(amount)).toLocaleString("en-US", {
    minimumFractionDigits: Number(amount) % 1 ? 2 : 0,
    maximumFractionDigits: 2
  })}`, [currency.symbol]);

  return (
    <AppContext.Provider value={{ bookings, currencies, currency, updateCurrency, saveBooking, deleteBooking, toggleBookingStatus, monthlyStats: stats, revenueAnimation, costLabels, updateCostLabel, updateMonthlyCosts, updateFixedCost, addRandomExpense, updateRandomExpense, deleteRandomExpense, formatCurrency }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
