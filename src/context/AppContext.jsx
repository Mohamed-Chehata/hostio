import { createContext, useContext } from "react";
import "../utils/storageMigration";

const AppContext = createContext(null);

const currencies = {
  USD: { code: "USD", symbol: "$", name: "US Dollar" },
  CAD: { code: "CAD", symbol: "$", name: "Canadian Dollar" },
  GBP: { code: "GBP", symbol: "£", name: "British Pound" },
  EUR: { code: "EUR", symbol: "€", name: "Euro" }
};

export function AppProvider({ children }) {
  function resolveCurrency(settings) {
    const cachedCode = localStorage.getItem("hostrack-currency");
    const code = settings?.currency || cachedCode || "EUR";
    return {
      ...(currencies[code] || currencies.EUR),
      symbol: settings?.currency_symbol || currencies[code]?.symbol || "€"
    };
  }

  function formatCurrency(amount, symbol) {
    return `${Number(amount) < 0 ? "-" : ""}${symbol}${Math.abs(Number(amount)).toLocaleString("en-US", {
    minimumFractionDigits: Number(amount) % 1 ? 2 : 0,
    maximumFractionDigits: 2
    })}`;
  }

  return (
    <AppContext.Provider value={{ currencies, resolveCurrency, formatCurrency }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  return useContext(AppContext);
}
