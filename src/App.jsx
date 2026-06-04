import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { BottomNav } from "./components/BottomNav";
import { BookingEditSheet } from "./components/BookingEditSheet";
import { CostsSheet } from "./components/CostsSheet";
import { DeleteBookingSheet } from "./components/DeleteBookingSheet";
import { AddPropertySheet, DeletePropertySheet, PropertySelectorSheet } from "./components/PropertySheets";
import { SplashScreen } from "./components/SplashScreen";
import { Toast } from "./components/Toast";
import { useApp } from "./context/AppContext";
import { useAppData } from "./hooks/useAppData";
import { useAuth } from "./hooks/useAuth";
import { AddBookingScreen } from "./screens/AddBookingScreen";
import { AuthScreen } from "./screens/AuthScreen";
import { BookingsScreen } from "./screens/BookingsScreen";
import { DashboardScreen } from "./screens/DashboardScreen";
import { ExpensesScreen } from "./screens/ExpensesScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { StatsScreen } from "./screens/StatsScreen";

const tabOrder = { dashboard: 0, bookings: 1, add: 2, expenses: 3, stats: 4 };
const tabScreens = new Set(Object.keys(tabOrder));

export default function App() {
  const app = useApp();
  const auth = useAuth();
  const hasShownSplash = useRef(false);
  const [showSplash, setShowSplash] = useState(() => !hasShownSplash.current);
  const [revealContent, setRevealContent] = useState(() => hasShownSplash.current);
  const [screen, setScreen] = useState("dashboard");
  const [screenDirection, setScreenDirection] = useState(1);
  const [exitingScreen, setExitingScreen] = useState(null);
  const [exitingDirection, setExitingDirection] = useState(1);
  const [selectedMonth, setSelectedMonth] = useState("2025-07");
  const [expensesMonth, setExpensesMonth] = useState("2025-07");
  const dashboardMonth = "2025-07";
  const data = useAppData(auth.user, [dashboardMonth, selectedMonth, expensesMonth]);
  const [editingSheet, setEditingSheet] = useState(null);
  const [costsOpen, setCostsOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [addingProperty, setAddingProperty] = useState(false);
  const [propertyDeleteCandidate, setPropertyDeleteCandidate] = useState(null);
  const [toast, setToast] = useState(null);
  const [openSwipeId, setOpenSwipeId] = useState(null);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [deletionStages, setDeletionStages] = useState({});
  const [hasSeenSwipeHint, setHasSeenSwipeHint] = useState(() => localStorage.getItem("hasSeenSwipeHint") === "true");
  const swallowNextClick = useRef(false);
  const transitionTimer = useRef(null);
  const currentStats = data.monthlyStats.find((item) => item.month === dashboardMonth) || { month: dashboardMonth, rent: 0, cleaning: 0, randomExpenses: [], expenses: 0, totalRevenue: 0, occupancyNights: 0, occupancyRate: 0, netRevenue: 0 };
  const expensesStats = data.monthlyStats.find((item) => item.month === expensesMonth) || { month: expensesMonth, rent: 0, cleaning: 0, randomExpenses: [], expenses: 0, totalRevenue: 0, occupancyNights: 0, occupancyRate: 0, netRevenue: 0 };

  useEffect(() => {
    if (screen === "stats") data.fetchStatsMonths();
  }, [data.activePropertyId, screen]);

  useEffect(() => {
    if (!data.error) return;
    const message = data.error.message === "You need at least one property" ? "You need at least one property" : "Something went wrong";
    showErrorToast(message);
    data.setError(null);
  }, [data.error]);

  function openEditor(booking) {
    setEditingSheet(booking);
  }

  function saveBooking(booking) {
    data.addBooking(booking);
    setSelectedMonth(booking.checkIn.slice(0, 7));
    setEditingSheet(null);
    if (screen === "add") navigate("bookings");
    showToast("Booking saved");
  }

  function requestDelete(booking) {
    setOpenSwipeId(null);
    setEditingSheet(null);
    setDeleteCandidate(booking);
  }

  function cancelDelete() {
    setDeleteCandidate(null);
    setOpenSwipeId(null);
  }

  function confirmDelete() {
    const id = deleteCandidate.id;
    setDeleteCandidate(null);
    setOpenSwipeId(null);
    setDeletionStages((current) => ({ ...current, [id]: "loading" }));
    setTimeout(() => setDeletionStages((current) => ({ ...current, [id]: "done" })), 2000);
    setTimeout(() => setDeletionStages((current) => ({ ...current, [id]: "removing" })), 2800);
    setTimeout(() => {
      data.deleteBooking(id);
      setDeletionStages((current) => {
        const next = { ...current };
        delete next[id];
        return next;
      });
    }, 3150);
  }

  function recordFirstSwipe() {
    if (hasSeenSwipeHint) return;
    localStorage.setItem("hasSeenSwipeHint", "true");
    setHasSeenSwipeHint(true);
  }

  function showToast(message) {
    setToast({ message, closing: false, type: "success" });
    setTimeout(() => setToast((current) => current ? { ...current, closing: true } : null), 1700);
    setTimeout(() => setToast(null), 2000);
  }

  function showErrorToast(message = "Something went wrong") {
    setToast({ message, closing: false, type: "error" });
    setTimeout(() => setToast((current) => current ? { ...current, closing: true } : null), 2700);
    setTimeout(() => setToast(null), 3000);
  }

  function navigate(next) {
    setEditingSheet(null);
    setCostsOpen(false);
    setOpenSwipeId(null);
    if (tabScreens.has(screen) && tabScreens.has(next) && screen !== next) {
      const nextDirection = tabOrder[next] > tabOrder[screen] ? 1 : -1;
      setScreenDirection(nextDirection);
      setExitingDirection(nextDirection);
      setExitingScreen(screen);
      clearTimeout(transitionTimer.current);
      transitionTimer.current = setTimeout(() => setExitingScreen(null), 220);
    }
    if (next === "stats") data.fetchStatsMonths();
    setScreen(next);
  }

  function toggleBookingStatus(id) {
    const booking = data.bookings.find((item) => item.id === id);
    if (!booking) return;
    data.updateBooking({ ...booking, status: booking.status === "Paid" ? "Unpaid" : "Paid" });
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
    if (tabName === "dashboard") return <DashboardScreen onNavigate={navigate} onSignOut={auth.signOut} onOpenProperties={() => setPropertiesOpen(true)} activePropertyName={data.activeProperty?.name || "My Property"} onEditCosts={() => setCostsOpen(true)} onEditBooking={openEditor} onRequestDelete={requestDelete} onToggleStatus={toggleBookingStatus} openSwipeId={openSwipeId} onOpenSwipe={setOpenSwipeId} onCloseSwipe={() => setOpenSwipeId(null)} onFirstSwipe={recordFirstSwipe} deletionStages={deletionStages} revenueAnimation={null} revenueDirection={null} stats={currentStats} bookings={data.bookings} costLabels={data.costLabels} formatCurrency={app.formatCurrency} />;
    if (tabName === "bookings") return <BookingsScreen month={selectedMonth} setMonth={setSelectedMonth} activePropertyName={data.activeProperty?.name || "My Property"} bookings={data.bookings} isLoading={data.isLoading} formatCurrency={app.formatCurrency} onSelect={openEditor} onRequestDelete={requestDelete} onToggleStatus={toggleBookingStatus} openSwipeId={openSwipeId} onOpenSwipe={setOpenSwipeId} onCloseSwipe={() => setOpenSwipeId(null)} onFirstSwipe={recordFirstSwipe} hasSeenSwipeHint={hasSeenSwipeHint} deletionStages={deletionStages} />;
    if (tabName === "add") return <AddBookingScreen currency={app.currency} onSave={saveBooking} />;
    if (tabName === "expenses") return <ExpensesScreen stats={expensesStats} month={expensesMonth} setMonth={setExpensesMonth} currency={app.currency} costLabels={data.costLabels} formatCurrency={app.formatCurrency} onUpdateCostLabel={(field, label) => data.updateUserSettings(field === "rent" ? { cost_label_1: label } : { cost_label_2: label })} onUpdateFixedCost={data.addFixedCost} onAddExpense={data.addExpense} onUpdateExpense={data.updateExpense} onDeleteExpense={data.deleteExpense} />;
    if (tabName === "stats") return <StatsScreen stats={data.statsMonths.length ? data.statsMonths : data.monthlyStats} activePropertyName={data.activeProperty?.name || "My Property"} formatCurrency={app.formatCurrency} />;
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

  const content = auth.isAuthLoading ? (
    <main className="mx-auto grid min-h-screen max-w-[390px] place-items-center bg-ink px-5 text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-accent" />
        <p className="mt-4 text-sm font-bold text-muted">Loading Hostio...</p>
      </div>
    </main>
  ) : !auth.session ? (
    <AuthScreen onSignIn={auth.signIn} onSignUp={auth.signUp} onSignedUp={() => setScreen("dashboard")} error={auth.authError} />
  ) : (
    <div className="mx-auto min-h-screen max-w-[390px] overflow-hidden bg-ink" onPointerDownCapture={closeSwipeFromOutside} onClickCapture={swallowOutsideClick}>
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
      {screen === "settings" && <SettingsScreen currency={app.currency} currencies={app.currencies} updateCurrency={app.updateCurrency} onBack={() => navigate("dashboard")} />}
      {screen !== "settings" && <BottomNav active={screen} onNavigate={navigate} />}
            {costsOpen && <CostsSheet stats={currentStats} currency={app.currency} costLabels={data.costLabels} onClose={() => setCostsOpen(false)} onSave={(costs) => { data.updateMonthlyCosts(currentStats.month, costs); setCostsOpen(false); }} />}
            {propertiesOpen && (
              <PropertySelectorSheet
                properties={data.properties}
                activePropertyId={data.activePropertyId}
                onSelect={(id) => {
                  data.setActivePropertyId(id);
                  setPropertiesOpen(false);
                }}
                onAdd={() => {
                  setPropertiesOpen(false);
                  setAddingProperty(true);
                }}
                onRename={data.renameProperty}
                onRequestDelete={(property) => setPropertyDeleteCandidate(property)}
                onClose={() => setPropertiesOpen(false)}
              />
            )}
            {addingProperty && (
              <AddPropertySheet
                onClose={() => setAddingProperty(false)}
                onSave={async (name) => {
                  await data.addProperty(name);
                  setAddingProperty(false);
                }}
              />
            )}
            <DeletePropertySheet
              property={propertyDeleteCandidate}
              onCancel={() => setPropertyDeleteCandidate(null)}
              onConfirm={async () => {
                await data.deleteProperty(propertyDeleteCandidate.id);
                setPropertyDeleteCandidate(null);
              }}
            />
            <BookingEditSheet booking={editingSheet} currency={app.currency} onClose={() => setEditingSheet(null)} onSave={saveBooking} onDelete={requestDelete} />
      <DeleteBookingSheet booking={deleteCandidate} onCancel={cancelDelete} onConfirm={confirmDelete} />
      <Toast message={toast?.message} closing={toast?.closing} type={toast?.type} />
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
            hasShownSplash.current = true;
            setShowSplash(false);
          }}
        />
      )}
    </>
  );
}
