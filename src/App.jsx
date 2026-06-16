import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Check, X } from "lucide-react";
import logo from "./assets/logo.png";
import { BottomNav } from "./components/BottomNav";
import { BookingEditSheet } from "./components/BookingEditSheet";
import { CancellationPayoutSheet } from "./components/CancellationPayoutSheet";
import { DeleteBookingSheet } from "./components/DeleteBookingSheet";
import { AddPropertySheet, PropertyActionSheet, PropertyDeletedSheet, PropertySelectorSheet } from "./components/PropertySheets";
import { PullToRefresh } from "./components/PullToRefresh";
import { PwaUpdateBanner } from "./components/PwaUpdateBanner";
import { PropertyLimitSheet, PropertySelectionScreen } from "./components/SubscriptionFlows";
import { SplashScreen } from "./components/SplashScreen";
import { Toast } from "./components/Toast";
import { SyncFailuresSheet } from "./components/SyncFailuresSheet";
import { useApp } from "./context/AppContext";
import { useAppData } from "./hooks/useAppData";
import { useAuth } from "./hooks/useAuth";
import { useSubscription } from "./hooks/useSubscription";
import { useToast } from "./hooks/useToast";
import { confirmPropertySelection, openBillingPortal, startCheckout } from "./lib/billing";
import { supabase } from "./lib/supabase";
import { PLANS } from "./config/pricing";
import { AddBookingScreen } from "./screens/AddBookingScreen";
import { AllPropertiesScreen } from "./screens/AllPropertiesScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { BookingsScreen } from "./screens/BookingsScreen";
import { CheckoutStatusScreen } from "./screens/CheckoutStatusScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ExpensesScreen } from "./screens/ExpensesScreen";
import { ImportBookingsScreen } from "./screens/ImportBookingsScreen";
import { PaywallScreen } from "./screens/PaywallScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";
import { getDataError, getToastTypeForError } from "./utils/errorHandler";
import { currentMonthKey, moveMonth } from "./utils/monthUtils";

const tabOrder = { dashboard: 0, bookings: 1, add: 2, expenses: 3, stats: 4, settings: 5, "import-bookings": 6, "all-properties": 7 };
const tabScreens = new Set(Object.keys(tabOrder));
const transientScreens = new Set(["import-bookings"]);

export default function App() {
  const app = useApp();
  const auth = useAuth();
  const subscription = useSubscription(auth.user);
  const { toast, showToast, dismissToast } = useToast();
  const hasSeenSplash = sessionStorage.getItem("splashShown") === "true" || localStorage.getItem("hostrack-app-launched") === "true";
  const [showSplash, setShowSplash] = useState(() => !hasSeenSplash);
  const [revealContent, setRevealContent] = useState(() => hasSeenSplash);
  const [recoveryMode, setRecoveryMode] = useState(() => window.location.pathname === "/reset-password" || window.location.hash.includes("type=recovery"));
  const [accountTransition, setAccountTransition] = useState(null);
  const [authAction, setAuthAction] = useState(null);
  const [paywallOpen, setPaywallOpen] = useState(() => new URLSearchParams(window.location.search).get("checkout") === "cancel");
  const [propertyLimitOpen, setPropertyLimitOpen] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState(() => {
    const checkout = new URLSearchParams(window.location.search).get("checkout");
    return checkout === "success" ? "pending" : null;
  });
  const [syncReviewOpen, setSyncReviewOpen] = useState(false);
  const [screen, setScreen] = useState(() => {
    if (window.location.pathname === "/settings") return "settings";
    const saved = sessionStorage.getItem("activeTab");
    return tabScreens.has(saved) ? saved : "dashboard";
  });
  const [screenDirection, setScreenDirection] = useState(1);
  const [exitingScreen, setExitingScreen] = useState(null);
  const [exitingDirection, setExitingDirection] = useState(1);
  const [dashboardMonth, setDashboardMonth] = useState(currentMonthKey);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [expensesMonth, setExpensesMonth] = useState(currentMonthKey);
  const dataUser = auth.user && (subscription.hasAccess || !subscription.isResolved) ? auth.user : null;
  const data = useAppData(dataUser, [dashboardMonth, selectedMonth, expensesMonth]);
  const [isDarkTheme, setIsDarkTheme] = useState(() => window.matchMedia("(prefers-color-scheme: dark)").matches);
  const currency = useMemo(() => app.resolveCurrency(data.userSettings), [app, data.userSettings]);
  const formatCurrency = useCallback((amount) => app.formatCurrency(amount, currency.symbol), [app, currency.symbol]);
  const [editingSheet, setEditingSheet] = useState(null);
  const [cancellationCandidate, setCancellationCandidate] = useState(null);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [addingProperty, setAddingProperty] = useState(false);
  const [propertyAction, setPropertyAction] = useState(null);
  const [deletingProperty, setDeletingProperty] = useState(null);
  const [deletedProperty, setDeletedProperty] = useState(null);
  const deletedPropertyNextId = useRef(null);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletionStages, setDeletionStages] = useState({});
  const [accountEmail, setAccountEmail] = useState("");
  const [trialBannerDismissed, setTrialBannerDismissed] = useState(false);
  const [loadingFloorComplete, setLoadingFloorComplete] = useState(false);
  const swallowNextClick = useRef(false);
  const transitionTimer = useRef(null);
  const loadingStartedAt = useRef(null);
  const previousSession = useRef(auth.session);
  const screenHistory = useRef([]);
  const exitBackPressedAt = useRef(0);
  const backGuardReady = useRef(false);
  const allowNextBrowserBack = useRef(false);
  const currentStats = data.monthlyStats.find((item) => item.month === dashboardMonth) || { month: dashboardMonth, rent: 0, cleaning: 0, randomExpenses: [], expenses: 0, totalRevenue: 0, unpaidRevenue: 0, pendingPayouts: [], occupancyNights: 0, occupancyRate: 0, netRevenue: 0 };
  const expensesStats = data.monthlyStats.find((item) => item.month === expensesMonth) || { month: expensesMonth, rent: 0, cleaning: 0, randomExpenses: [], expenses: 0, totalRevenue: 0, unpaidRevenue: 0, pendingPayouts: [], occupancyNights: 0, occupancyRate: 0, netRevenue: 0 };
  const dashboardBookings = data.bookingsByMonth[dashboardMonth] || [];
  const activePropertyLocked = Boolean(data.activeProperty?.is_locked);
  const currentPlan = subscription.subscription?.plan;
  const currentPlanLimit = PLANS[currentPlan]?.propertyLimit ?? Infinity;
  const authenticatedStateReady = subscription.isResolved
    && (!subscription.hasAccess || data.baseInitialized);
  const rawAppReady = !auth.isAuthLoading
    && (!auth.session || recoveryMode || authenticatedStateReady);
  const hasCachedAppShell = Boolean(auth.session && data.baseInitialized);
  const shouldUseFullLoading = !hasCachedAppShell && !authAction;
  const isAppReady = hasCachedAppShell || (rawAppReady && loadingFloorComplete);

  useEffect(() => {
    if (loadingFloorComplete || hasCachedAppShell) return undefined;
    let timer;

    if (!revealContent) {
      return undefined;
    }

    if (loadingStartedAt.current === null) {
      loadingStartedAt.current = Date.now();
    }

    if (!rawAppReady) return undefined;

    const remaining = Math.max(0, 1000 - (Date.now() - loadingStartedAt.current));
    timer = setTimeout(() => setLoadingFloorComplete(true), remaining);
    return () => clearTimeout(timer);
  }, [hasCachedAppShell, loadingFloorComplete, rawAppReady, revealContent]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "cancel") return;
    params.delete("checkout");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  }, []);

  useEffect(() => {
    if (checkoutStatus !== "pending" || !auth.user?.id) return undefined;
    let cancelled = false;
    const deadline = Date.now() + 10000;

    async function poll() {
      const latest = await subscription.refetch();
      if (cancelled) return;
      if (latest?.status === "active") {
        const params = new URLSearchParams(window.location.search);
        params.delete("checkout");
        const query = params.toString();
        window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
        setCheckoutStatus("complete");
        return;
      }
      const remaining = deadline - Date.now();
      if (remaining > 0) setTimeout(poll, Math.min(1500, remaining));
      else {
        const params = new URLSearchParams(window.location.search);
        params.delete("checkout");
        window.history.replaceState({}, "", window.location.pathname);
        setCheckoutStatus(null);
        setPaywallOpen(true);
      }
    }

    poll();
    return () => {
      cancelled = true;
    };
  }, [auth.user?.id, checkoutStatus, subscription.refetch]);

  useEffect(() => {
    if (checkoutStatus !== "complete") return undefined;
    const timer = setTimeout(() => {
      setCheckoutStatus(null);
      setPaywallOpen(false);
      sessionStorage.setItem("activeTab", "dashboard");
      setScreen("dashboard");
    }, 1500);
    return () => clearTimeout(timer);
  }, [checkoutStatus]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const theme = data.userSettings.theme || "system";
    const applyTheme = () => {
      const dark = theme === "dark" || (theme === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#080A0C" : "#F5F5F5");
      setIsDarkTheme(dark);
    };
    applyTheme();
    if (theme !== "system") return undefined;
    media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [data.userSettings.theme]);

  useEffect(() => {
    let cancelled = false;

    async function handleRecoveryHash() {
      const hash = window.location.hash;
      if (!hash || !hash.includes("type=recovery")) return;

      setRecoveryMode(true);
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get("access_token");
      const refreshToken = params.get("refresh_token");

      if (!accessToken || !refreshToken) {
        window.history.replaceState({}, "", "/");
        setRecoveryMode(false);
        return;
      }

      localStorage.setItem("hostrackPasswordRecovery", "true");
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (cancelled) return;
      if (error) {
        window.history.replaceState({}, "", "/");
        setRecoveryMode(false);
        return;
      }

      window.history.replaceState({}, "", "/reset-password");
      window.dispatchEvent(new CustomEvent("hostrack:password-recovery"));
    }

    handleRecoveryHash();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (screen === "stats") data.fetchStatsMonths();
  }, [data.activePropertyId, screen]);

  useEffect(() => {
    const wasSignedOut = !previousSession.current;
    previousSession.current = auth.session;
    if (!wasSignedOut || !auth.session) return;
    sessionStorage.setItem("activeTab", "dashboard");
    sessionStorage.removeItem("statsPageIndex");
    screenHistory.current = [];
    setScreen("dashboard");
  }, [auth.session]);

  useEffect(() => {
    if (!revealContent) return undefined;
    if (!backGuardReady.current) {
      window.history.pushState({ page: screen || "dashboard" }, "", window.location.href);
      backGuardReady.current = true;
    }

    function restoreBackGuard() {
      window.history.pushState({ page: screen || "dashboard" }, "", window.location.href);
    }

    function blurFocusedInput() {
      const element = document.activeElement;
      if (!element) return false;
      const tagName = element.tagName?.toLowerCase();
      const editable = tagName === "input" || tagName === "textarea" || element.isContentEditable;
      if (!editable) return false;
      element.blur();
      return true;
    }

    function closeTopSheet() {
      if (syncReviewOpen) {
        setSyncReviewOpen(false);
        return true;
      }
      if (deleteCandidate) {
        cancelDelete();
        return true;
      }
      if (cancellationCandidate) {
        setCancellationCandidate(null);
        return true;
      }
      if (editingSheet) {
        setEditingSheet(null);
        return true;
      }
      if (deletedProperty) {
        setDeletedProperty(null);
        return true;
      }
      if (propertyLimitOpen) {
        setPropertyLimitOpen(false);
        return true;
      }
      if (addingProperty) {
        setAddingProperty(false);
        return true;
      }
      if (propertyAction) {
        setPropertyAction(null);
        return true;
      }
      if (propertiesOpen) {
        setPropertiesOpen(false);
        return true;
      }
      if (paywallOpen) {
        setPaywallOpen(false);
        return true;
      }
      if (openSwipeId) {
        setOpenSwipeId(null);
        return true;
      }
      return false;
    }

    function goBackInsideApp() {
      const previous = screenHistory.current.pop();
      if (!previous || previous === screen) return false;
      navigate(previous, { fromBack: true });
      return true;
    }

    function handleBackPress() {
      if (allowNextBrowserBack.current) {
        allowNextBrowserBack.current = false;
        return;
      }

      if (blurFocusedInput()) {
        restoreBackGuard();
        return;
      }

      if (closeTopSheet()) {
        restoreBackGuard();
        return;
      }

      if (screen === "import-bookings") {
        const handled = !window.dispatchEvent(new CustomEvent("hostrack:app-back", { cancelable: true }));
        if (handled) {
          restoreBackGuard();
          return;
        }
      }

      if (["bookings", "expenses", "stats"].includes(screen)) {
        navigate("dashboard", { fromBack: true });
        restoreBackGuard();
        return;
      }

      if (screen !== "dashboard") {
        if (!goBackInsideApp()) navigate("dashboard", { fromBack: true });
        restoreBackGuard();
        return;
      }

      const now = Date.now();
      if (now - exitBackPressedAt.current < 2000) {
        exitBackPressedAt.current = 0;
        if (navigator.app?.exitApp) navigator.app.exitApp();
        else {
          allowNextBrowserBack.current = true;
          setTimeout(() => window.history.back(), 0);
        }
        return;
      }
      exitBackPressedAt.current = now;
      showToast("Press back again to exit", "warning", { duration: 2000 });
      restoreBackGuard();
    }

    window.addEventListener("popstate", handleBackPress);
    return () => window.removeEventListener("popstate", handleBackPress);
  }, [
    addingProperty,
    cancellationCandidate,
    deleteCandidate,
    deletedProperty,
    editingSheet,
    openSwipeId,
    paywallOpen,
    propertiesOpen,
    propertyAction,
    propertyLimitOpen,
    revealContent,
    screen,
    showToast,
    syncReviewOpen
  ]);

  useEffect(() => {
    let cancelled = false;
    async function loadProfileInitial() {
      const { data: userData } = await supabase.auth.getUser();
      if (cancelled) return;
      const email = userData.user?.email || auth.user?.email || "";
      setAccountEmail(email);
    }
    if (auth.session) loadProfileInitial();
    return () => {
      cancelled = true;
    };
  }, [auth.session, auth.user?.email]);

  useEffect(() => {
    if (!data.error) return;
    const message = data.error.message === "You need at least one property" ? "You need at least one property" : getDataError(data.error);
    showToast(message, getToastTypeForError(data.error, message));
    data.setError(null);
  }, [data.error, showToast]);

  useEffect(() => {
    if (!subscription.error) return;
    showToast("Something went wrong", "error");
  }, [showToast, subscription.error]);

  useEffect(() => {
    if (authAction !== "login") return;
    if (!auth.session || !authenticatedStateReady) return;
    setAuthAction(null);
  }, [auth.session, authAction, authenticatedStateReady]);

  function openEditor(booking) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return;
    }
    setEditingSheet(booking);
  }

  async function saveBooking(booking) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const saved = await data.saveBooking(booking);
    if (!saved || saved.conflict) return saved;
    setSelectedMonth(booking.checkIn.slice(0, 7));
    setEditingSheet(null);
    if (screen === "add") navigate("bookings");
    showToast("Booking saved", "success");
    return saved;
  }

  function requestDelete(booking) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return;
    }
    setOpenSwipeId(null);
    setEditingSheet(null);
    setDeleteCandidate(booking);
  }

  function requestCancellation(booking) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return;
    }
    setEditingSheet(null);
    setCancellationCandidate(booking);
  }

  async function confirmCancellation({ percent, availableAt }) {
    if (!cancellationCandidate) return false;
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const originalRevenue = Number(cancellationCandidate.originalRevenue ?? cancellationCandidate.revenue ?? 0);
    const adjustedRevenue = originalRevenue * (percent / 100);
    const saved = await data.saveBooking({
      ...cancellationCandidate,
      bookingStatus: "cancelled",
      originalRevenue,
      revenue: adjustedRevenue,
      cancellationPayoutPercent: percent,
      cancellationPayoutAvailableAt: availableAt.toISOString()
    });
    if (!saved || saved.conflict) return false;
    setCancellationCandidate(null);
    showToast("Reservation cancelled", "success");
    return true;
  }

  function cancelDelete() {
    setDeleteCandidate(null);
    setOpenSwipeId(null);
  }

  async function confirmDelete() {
    if (!deleteCandidate) return;
    if (activePropertyLocked) {
      setDeleteCandidate(null);
      showToast("Unlock this property to make changes", "warning");
      return;
    }
    const id = deleteCandidate.id;
    setDeleteCandidate(null);
    setOpenSwipeId(null);
    setDeletionStages((current) => ({ ...current, [id]: "loading" }));
    const deleted = await data.deleteBooking(id, { deferLocalRemoval: true });
    if (!deleted) {
      setDeletionStages((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
      return;
    }
    setDeletionStages((current) => ({ ...current, [id]: "done" }));
    setTimeout(() => setDeletionStages((current) => ({ ...current, [id]: "removing" })), 800);
    setTimeout(() => {
      data.finalizeBookingDeletion(id, deleted.month);
      setDeletionStages((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, 1150);
  }

  function navigate(next, options = {}) {
    if (next === "add" && activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return;
    }
    if (!options.fromBack && screen !== next && tabScreens.has(screen) && tabScreens.has(next)) {
      screenHistory.current = [...screenHistory.current.filter((item) => item !== next), screen].slice(-12);
      window.history.pushState({ page: next }, "", window.location.href);
    }
    setEditingSheet(null);
    setOpenSwipeId(null);
    if (tabScreens.has(screen) && tabScreens.has(next) && screen !== next) {
      const nextDirection = tabOrder[next] > tabOrder[screen] ? 1 : -1;
      setScreenDirection(nextDirection);
      setExitingDirection(nextDirection);
      clearTimeout(transitionTimer.current);
      if (screen === "import-bookings") {
        setExitingScreen(null);
      } else {
        setExitingScreen(screen);
        transitionTimer.current = setTimeout(() => setExitingScreen(null), 220);
      }
    }
    if (tabScreens.has(next) && !transientScreens.has(next)) sessionStorage.setItem("activeTab", next);
    setScreen(next);
  }

  function updateBookingPaymentOverride(id, paymentOverride) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return;
    }
    const booking = data.bookings.find((item) => item.id === id);
    if (!booking) return;
    data.saveBooking({ ...booking, paymentOverride });
  }

  async function updateCostLabel(field, label) {
    const updated = await data.updateUserSettings(field === "rent" ? { cost_label_1: label } : { cost_label_2: label });
    if (updated) showToast("Label updated", "success");
  }

  async function updateFixedCost(month, field, amount) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const updated = await data.updateFixedCost(month, field, amount);
    if (updated) showToast(`${field === "rent" ? data.costLabels.rent : data.costLabels.cleaning} updated`, "success");
  }

  async function addExpense(month, expense) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const added = await data.addExpense(month, expense);
    if (added) showToast("Expense added", "success");
    return added;
  }

  async function updateExpense(month, expense) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const updated = await data.updateExpense(month, expense);
    if (updated) showToast("Expense updated", "success");
    return updated;
  }

  async function deleteExpense(month, id) {
    if (activePropertyLocked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const deleted = await data.deleteExpense(month, id);
    if (deleted) showToast("Expense deleted", "success");
    return deleted;
  }

  async function renameProperty(id, name) {
    const property = data.properties.find((item) => item.id === id);
    if (property?.is_locked) {
      showToast("Unlock this property to make changes", "warning");
      return false;
    }
    const renamed = await data.renameProperty(id, name);
    if (renamed) showToast("Property renamed", "success");
    return renamed;
  }

  function switchProperty(id) {
    data.setActivePropertyId(id);
  }

  function openAddProperty() {
    if (data.properties.length >= currentPlanLimit) {
      setPropertiesOpen(false);
      setPropertyLimitOpen(true);
      return;
    }
    setPropertiesOpen(false);
    setAddingProperty(true);
  }

  async function choosePlan(plan) {
    try {
      await startCheckout(plan, auth.user.id);
    } catch (error) {
      showToast("Something went wrong", "error");
      throw error;
    }
  }

  async function manageSubscription() {
    try {
      await openBillingPortal(auth.user.id);
    } catch {
      showToast("Something went wrong", "error");
    }
  }

  async function completePropertySelection(ids) {
    try {
      await confirmPropertySelection(ids);
      await Promise.all([subscription.refetch(), data.refreshProperties()]);
      return true;
    } catch {
      showToast("Something went wrong", "error");
      return false;
    }
  }

  async function updateCurrency(code) {
    const option = app.currencies[code];
    return data.updateUserSettings({ currency: code, currency_symbol: option?.symbol || currency.symbol });
  }

  async function deleteAccountData() {
    setAccountTransition({ type: "delete", stage: "working" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const deleted = await data.deleteUserData();
    if (!deleted) {
      setAccountTransition(null);
      return false;
    }
    setAccountTransition({ type: "delete", stage: "done" });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    clearSignedOutStorage();
    await auth.signOut();
    setAccountTransition(null);
    return true;
  }

  function clearSignedOutStorage() {
    sessionStorage.removeItem("activeTab");
    sessionStorage.removeItem("statsPageIndex");
    localStorage.removeItem("activePropertyId");
  }

  async function signOutWithTransition() {
    setAccountTransition({ type: "signout", stage: "working" });
    await new Promise((resolve) => setTimeout(resolve, 200));
    const startedAt = Date.now();
    clearSignedOutStorage();
    try {
      await auth.signOut();
      const remaining = Math.max(0, 500 - (Date.now() - startedAt));
      await new Promise((resolve) => setTimeout(resolve, remaining));
    } finally {
      setAccountTransition(null);
    }
  }

  function changeDashboardMonth(amount) {
    setDashboardMonth((current) => moveMonth(current, amount));
  }

  function openExpensesForDashboardMonth() {
    setExpensesMonth(dashboardMonth);
    navigate("expenses");
  }

  function seeAllDashboardBookings() {
    setSelectedMonth(dashboardMonth);
    navigate("bookings");
  }

  function closeSwipeFromOutside(event) {
    if (!openSwipeId) return;
    if (event.target.closest(`[data-booking-card="${openSwipeId}"]`)) return;
    event.preventDefault();
    event.stopPropagation();
    swallowNextClick.current = true;
    setOpenSwipeId(null);
  }

  function swallowOutsideClick(event) {
    if (!swallowNextClick.current) return;
    swallowNextClick.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  function renderTabScreen(tabName) {
    if (tabName === "dashboard") return (
      <PullToRefresh onRefresh={() => data.refreshMonth(dashboardMonth)}>
        <DashboardScreen onNavigate={navigate} onOpenProperties={() => setPropertiesOpen(true)} activePropertyName={data.activeProperty?.name || "My Property"} onMonthChange={changeDashboardMonth} onOpenExpenses={openExpensesForDashboardMonth} onSeeAllBookings={seeAllDashboardBookings} onEditBooking={openEditor} onRequestDelete={requestDelete} onPaymentOverride={updateBookingPaymentOverride} onRetry={() => data.retryMonth(dashboardMonth)} onUpgrade={() => setPaywallOpen(true)} onDismissTrialBanner={() => setTrialBannerDismissed(true)} trialDaysRemaining={subscription.trialDaysRemaining} showTrialBanner={!trialBannerDismissed && subscription.subscription?.status === "trialing" && subscription.trialDaysRemaining > 0 && subscription.trialDaysRemaining <= 2} openSwipeId={openSwipeId} onOpenSwipe={activePropertyLocked ? () => showToast("Unlock this property to make changes", "warning") : setOpenSwipeId} onCloseSwipe={() => setOpenSwipeId(null)} deletionStages={deletionStages} revenueAnimation={null} revenueDirection={null} stats={currentStats} bookings={dashboardBookings} isLoading={data.isMonthLoading(dashboardMonth)} isInitialized={data.isMonthInitialized(dashboardMonth)} offlineUnavailable={data.isMonthOfflineUnavailable(dashboardMonth)} isOnline={data.isOnline} isSyncing={data.isSyncing} costLabels={data.costLabels} formatCurrency={formatCurrency} locked={activePropertyLocked} />
      </PullToRefresh>
    );
    if (tabName === "bookings") return (
      <PullToRefresh onRefresh={() => data.refreshMonth(selectedMonth)}>
        <BookingsScreen month={selectedMonth} setMonth={setSelectedMonth} activePropertyName={data.activeProperty?.name || "My Property"} onOpenProperties={() => setPropertiesOpen(true)} bookings={data.bookingsByMonth[selectedMonth] || []} isLoading={data.isMonthLoading(selectedMonth)} isInitialized={data.isMonthInitialized(selectedMonth)} offlineUnavailable={data.isMonthOfflineUnavailable(selectedMonth)} isOnline={data.isOnline} isSyncing={data.isSyncing} onRetry={() => data.retryMonth(selectedMonth)} formatCurrency={formatCurrency} onSelect={openEditor} onRequestDelete={requestDelete} onPaymentOverride={updateBookingPaymentOverride} openSwipeId={openSwipeId} onOpenSwipe={activePropertyLocked ? () => showToast("Unlock this property to make changes", "warning") : setOpenSwipeId} onCloseSwipe={() => setOpenSwipeId(null)} deletionStages={deletionStages} locked={activePropertyLocked} onUpgrade={() => setPaywallOpen(true)} />
      </PullToRefresh>
    );
    if (tabName === "add") return <AddBookingScreen currency={currency} onCheckConflict={data.checkBookingConflict} onSave={saveBooking} />;
    if (tabName === "expenses") return (
      <PullToRefresh onRefresh={() => data.refreshMonth(expensesMonth)}>
        <ExpensesScreen stats={expensesStats} month={expensesMonth} setMonth={setExpensesMonth} activePropertyName={data.activeProperty?.name || "My Property"} onOpenProperties={() => setPropertiesOpen(true)} isLoading={data.isMonthLoading(expensesMonth)} isInitialized={data.isMonthInitialized(expensesMonth)} offlineUnavailable={data.isMonthOfflineUnavailable(expensesMonth)} isOnline={data.isOnline} isSyncing={data.isSyncing} onRetry={() => data.retryMonth(expensesMonth)} currency={currency} costLabels={data.costLabels} formatCurrency={formatCurrency} onUpdateCostLabel={updateCostLabel} onUpdateFixedCost={updateFixedCost} onAddExpense={addExpense} onUpdateExpense={updateExpense} onDeleteExpense={deleteExpense} locked={activePropertyLocked} onUpgrade={() => setPaywallOpen(true)} onLockedAction={() => showToast("Unlock this property to make changes", "warning")} />
      </PullToRefresh>
    );
    if (tabName === "stats") return (
      <PullToRefresh onRefresh={data.refreshStatsMonths}>
        <StatsScreen stats={data.statsMonths} isLoading={data.statsLoading} isInitialized={data.statsInitialized} activePropertyId={data.activePropertyId} activePropertyName={data.activeProperty?.name || "My Property"} onOpenProperties={() => setPropertiesOpen(true)} onOpenAllProperties={() => navigate("all-properties")} onRetry={data.fetchStatsMonths} formatCurrency={formatCurrency} isDarkTheme={isDarkTheme} isOnline={data.isOnline} isSyncing={data.isSyncing} />
      </PullToRefresh>
    );
    if (tabName === "all-properties") return <AllPropertiesScreen properties={data.properties} monthsData={data.allPropertiesMonths} isMonthLoading={data.isAllPropertiesMonthLoading} isMonthInitialized={data.isAllPropertiesMonthInitialized} fetchMonth={data.fetchAllPropertiesMonth} refreshMonth={data.refreshAllPropertiesMonth} formatCurrency={formatCurrency} isDarkTheme={isDarkTheme} isOnline={data.isOnline} isSyncing={data.isSyncing} onBack={() => navigate("dashboard")} />;
    if (tabName === "import-bookings") return (
      <ImportBookingsScreen
        properties={data.properties}
        formatCurrency={formatCurrency}
        onBack={() => navigate("settings")}
        onAddProperty={(name) => {
          if (data.properties.length >= currentPlanLimit) {
            setPropertyLimitOpen(true);
            return null;
          }
          return data.addProperty(name, { activate: false });
        }}
        canAddProperty={data.properties.length < currentPlanLimit}
        onPropertyLimit={() => setPropertyLimitOpen(true)}
        onCheckConflicts={data.checkImportConflicts}
        onImport={data.importBookings}
        onViewBookings={(propertyId, month) => {
          data.setActivePropertyId(propertyId);
          if (month) setSelectedMonth(month);
          navigate("bookings");
        }}
      />
    );
    if (tabName === "settings") return (
      <SettingsScreen
        currency={currency}
        currencies={app.currencies}
        subscription={subscription.subscription}
        trialDaysRemaining={subscription.trialDaysRemaining}
        theme={data.userSettings.theme || "system"}
        updateTheme={async (theme) => {
          const updated = await data.updateUserSettings({ theme });
          if (updated) showToast("Appearance updated", "success");
          return updated;
        }}
        updateCurrency={updateCurrency}
        onCurrencyUpdated={() => showToast("Currency updated", "success")}
        email={accountEmail}
        onImportData={() => navigate("import-bookings")}
        onChangePassword={async () => {
          const sent = await auth.sendPasswordReset();
          showToast(sent ? "Password reset email sent" : "Something went wrong", sent ? "success" : "error");
          return sent;
        }}
        onSignOut={signOutWithTransition}
        onDeleteAccount={deleteAccountData}
        onChoosePlan={() => setPaywallOpen(true)}
        onManageSubscription={manageSubscription}
        onBack={() => navigate("dashboard")}
      />
    );
    return null;
  }

  function enterAnimation(tabName) {
    const side = screenDirection > 0 ? "right" : "left";
    if (tabName === "add") return side === "right" ? "animate-screen-enter-right-pop" : "animate-screen-enter-left-pop";
    return side === "right" ? "animate-screen-enter-right" : "animate-screen-enter-left";
  }

  function exitAnimation() {
    return exitingDirection > 0 ? "animate-screen-exit-left" : "animate-screen-exit-right";
  }

  const authScreen = (
    <AuthScreen
      initialMode={recoveryMode ? "reset-password" : undefined}
      onRecoveryComplete={() => setRecoveryMode(false)}
      onSignIn={auth.signIn}
      onSignUp={auth.signUp}
      onLoadingChange={setAuthAction}
      onSignedUp={() => {
        sessionStorage.setItem("activeTab", "dashboard");
        sessionStorage.removeItem("statsPageIndex");
        setScreen("dashboard");
      }}
      error={auth.authError}
    />
  );

  const content = authAction ? (
    authScreen
  ) : checkoutStatus && auth.session ? (
    <CheckoutStatusScreen
      status={checkoutStatus}
      planId={subscription.subscription?.plan}
    />
  ) : !isAppReady && shouldUseFullLoading ? (
    <AppLoadingScreen />
  ) : !auth.session || recoveryMode ? (
    authScreen
  ) : subscription.isResolved && subscription.subscription?.needs_property_selection ? (
    <PropertySelectionScreen
      properties={data.properties}
      planId={subscription.subscription.plan}
      onConfirm={completePropertySelection}
    />
  ) : paywallOpen ? (
    <PaywallScreen
      subscription={subscription.subscription}
      onChoosePlan={choosePlan}
      onBack={() => setPaywallOpen(false)}
    />
  ) : subscription.isResolved && !subscription.hasAccess ? (
    <PaywallScreen
      subscription={subscription.subscription}
      onChoosePlan={choosePlan}
      onSignOut={signOutWithTransition}
    />
  ) : (
    <div className="mx-auto min-h-screen max-w-[390px] overflow-hidden bg-app" onPointerDownCapture={closeSwipeFromOutside} onClickCapture={swallowOutsideClick}>
      {tabScreens.has(screen) && (
        <div className="relative min-h-screen">
          {exitingScreen && (
            <div
              key={`${exitingScreen}-exit`}
              onAnimationEnd={() => setExitingScreen(null)}
              className={`pointer-events-none absolute inset-x-0 top-0 z-0 w-full ${exitAnimation()}`}
            >
              {renderTabScreen(exitingScreen)}
            </div>
          )}
          <div
            key={screen}
            className={`relative z-10 ${enterAnimation(screen)}`}
          >
            {renderTabScreen(screen)}
          </div>
        </div>
      )}
      {screen !== "settings" && screen !== "all-properties" && screen !== "import-bookings" && <BottomNav active={screen} onNavigate={navigate} />}
            {propertiesOpen && (
              <PropertySelectorSheet
                properties={data.properties}
                activePropertyId={data.activePropertyId}
                deletingProperty={deletingProperty}
                onSelect={(id) => {
                  switchProperty(id);
                  setPropertiesOpen(false);
                }}
                onAdd={openAddProperty}
                onAction={setPropertyAction}
                onClose={() => setPropertiesOpen(false)}
              />
            )}
            {propertyAction && (
              <PropertyActionSheet
                property={propertyAction}
                onClose={() => setPropertyAction(null)}
                onRename={async (name) => {
                  const renamed = await renameProperty(propertyAction.id, name);
                  if (renamed) setPropertyAction(null);
                  return renamed;
                }}
                onConfirmDelete={async () => {
                  if (data.properties.length <= 1) {
                    showToast("You need at least one property", "warning");
                    return false;
                  }
                  const property = propertyAction;
                  if (property.is_locked) {
                    showToast("Unlock this property to make changes", "warning");
                    return false;
                  }
                  const result = await data.deleteProperty(property.id, {
                    switchToRemaining: false,
                    deferLocalRemoval: true
                  });
                  if (!result) return false;
                  deletedPropertyNextId.current = result.nextPropertyId;
                  setDeletingProperty({ id: property.id, phase: "flash" });
                  setDeletedProperty(property);
                  setTimeout(() => setDeletingProperty({ id: property.id, phase: "collapse" }), 150);
                  return true;
                }}
              />
            )}
            {addingProperty && (
              <AddPropertySheet
                onClose={() => setAddingProperty(false)}
                onSave={async (name) => {
                  if (data.properties.length >= currentPlanLimit) {
                    setAddingProperty(false);
                    setPropertyLimitOpen(true);
                    return;
                  }
                  const property = await data.addProperty(name);
                  if (property) {
                    const currentMonth = currentMonthKey();
                    setDashboardMonth(currentMonth);
                    setSelectedMonth(currentMonth);
                    setExpensesMonth(currentMonth);
                    showToast("Property added", "success");
                    setAddingProperty(false);
                  }
                }}
              />
            )}
            {propertyLimitOpen && (
              <PropertyLimitSheet
                planId={currentPlan}
                onClose={() => setPropertyLimitOpen(false)}
                onUpgrade={() => {
                  setPropertyLimitOpen(false);
                  setPaywallOpen(true);
                }}
              />
            )}
            {deletedProperty && (
              <PropertyDeletedSheet
                property={deletedProperty}
                onComplete={() => {
                  const nextPropertyId = deletedPropertyNextId.current;
                  setDeletedProperty(null);
                  setDeletingProperty(null);
                  setPropertiesOpen(false);
                  deletedPropertyNextId.current = null;
                  data.finalizePropertyDeletion(deletedProperty.id);
                  if (nextPropertyId) switchProperty(nextPropertyId);
                }}
              />
            )}
            <BookingEditSheet booking={editingSheet} currency={currency} onClose={() => setEditingSheet(null)} onCheckConflict={data.checkBookingConflict} onSave={saveBooking} onDelete={requestDelete} onCancelReservation={requestCancellation} />
      <CancellationPayoutSheet booking={cancellationCandidate} formatCurrency={formatCurrency} onCancel={() => setCancellationCandidate(null)} onConfirm={confirmCancellation} />
      <DeleteBookingSheet booking={deleteCandidate} onCancel={cancelDelete} onConfirm={confirmDelete} />
      {data.syncFailures.length > 0 && !syncReviewOpen && (
        <div className="fixed bottom-[88px] left-1/2 z-[69] flex w-[calc(100%-24px)] max-w-[366px] -translate-x-1/2 items-center rounded-2xl bg-[#78350F] text-[#FFFFFF] shadow-2xl">
          <button onClick={() => setSyncReviewOpen(true)} className="flex min-h-14 flex-1 items-center gap-3 px-4 text-left text-sm font-extrabold">
            <AlertTriangle size={18} />
            <span>Some changes couldn't be saved. Tap to review.</span>
          </button>
          <button aria-label="Dismiss sync warning" onClick={data.dismissSyncFailures} className="grid h-11 w-11 shrink-0 place-items-center">
            <X size={17} />
          </button>
        </div>
      )}
      {syncReviewOpen && (
        <SyncFailuresSheet
          failures={data.syncFailures}
          formatCurrency={formatCurrency}
          onRetry={data.retrySyncOperation}
          onRetryAll={data.processSyncQueue}
          onDiscard={data.discardSyncOperation}
          onClose={() => setSyncReviewOpen(false)}
        />
      )}
      <Toast message={toast?.message} closing={toast?.closing} type={toast?.type} duration={toast?.duration} persistent={toast?.persistent} toastKey={toast?.id} onDismiss={dismissToast} />
    </div>
  );

  return (
    <>
      <motion.div
        initial={showSplash ? { y: "100%" } : { y: 0 }}
        animate={revealContent ? { y: 0 } : { y: "100%" }}
        transition={{ duration: revealContent ? 0.5 : 0, ease: [0.32, 0.72, 0, 1] }}
      >
        {content}
      </motion.div>
      {showSplash && (
        <SplashScreen
          onReveal={() => setRevealContent(true)}
          onComplete={() => {
            sessionStorage.setItem("splashShown", "true");
            localStorage.setItem("hostrack-app-launched", "true");
            setShowSplash(false);
          }}
        />
      )}
      <AnimatePresence>
        {accountTransition && <AccountTransitionOverlay transition={accountTransition} />}
      </AnimatePresence>
      <PwaUpdateBanner />
    </>
  );
}

function AppLoadingScreen() {
  return (
    <main className="mx-auto grid min-h-screen max-w-[390px] place-items-center bg-app px-5 text-center">
      <div>
        <span className="mx-auto block h-6 w-6 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
        <p className="mt-3 text-xs font-bold text-muted">Loading...</p>
      </div>
    </main>
  );
}

function AccountTransitionOverlay({ transition }) {
  const done = transition.stage === "done";
  const text = transition.type === "delete"
    ? done ? "Done" : "Deleting your account..."
    : "Signing out...";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="fixed inset-0 z-[100] grid place-items-center bg-app">
      <div className="text-center">
        {done ? (
          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.25, ease: [0.34, 1.56, 0.64, 1] }} className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-emerald-500 text-[#FFFFFF]">
            <Check size={30} strokeWidth={3} />
          </motion.div>
        ) : (
          <motion.img
            src={logo}
            alt="Hostrack"
            className="mx-auto h-16 w-16 rounded-2xl object-cover"
            animate={{ scale: [1, 1.05, 1] }}
            transition={{ duration: 1, ease: "easeInOut", repeat: Infinity }}
          />
        )}
        <p className="mt-5 text-sm font-bold text-muted">{text}</p>
      </div>
    </motion.div>
  );
}
