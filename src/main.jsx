import React from "react";
import ReactDOM from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import "./utils/storageMigration";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import "./index.css";

const initialTheme = localStorage.getItem("hostrack-theme") || "system";
const initialDark = initialTheme === "dark" || (initialTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark", initialDark);

registerSW({ immediate: true });

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
