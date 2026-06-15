import React from "react";
import ReactDOM from "react-dom/client";
import "./utils/storageMigration";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import "./index.css";

const initialTheme = localStorage.getItem("hostrack-theme") || "system";
const initialDark = initialTheme === "dark" || (initialTheme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle("dark", initialDark);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
