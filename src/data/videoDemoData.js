import { moveMonth } from "../utils/monthUtils";

function monthDays(month) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year, monthNumber, 0).getDate();
}

function dateInMonth(month, day) {
  return `${month}-${String(Math.min(day, monthDays(month))).padStart(2, "0")}`;
}

function booking(month, id, guestName, checkInDay, checkOutDay, revenue, paymentOverride = "paid") {
  const checkIn = dateInMonth(month, checkInDay);
  const checkOut = dateInMonth(month, checkOutDay);
  return {
    id: `video-demo-${month}-${id}`,
    guestName,
    checkIn,
    checkOut,
    nights: Math.max(1, checkOutDay - checkInDay),
    revenue,
    rating: null,
    status: paymentOverride === "paid" ? "Paid" : "Unpaid",
    paymentOverride,
    bookingStatus: "active",
    cancellationPayoutPercent: null,
    cancellationPayoutAvailableAt: null,
    originalRevenue: null
  };
}

const MONTH_PROFILES = [
  { paid: [920, 760, 640], pending: 480, rent: 1450, cleaning: 260, expenses: 185, nights: 19 },
  { paid: [1120, 840, 590], pending: 0, rent: 1450, cleaning: 280, expenses: 120, nights: 21 },
  { paid: [980, 875, 720], pending: 510, rent: 1450, cleaning: 310, expenses: 245, nights: 23 },
  { paid: [1280, 960, 810], pending: 0, rent: 1450, cleaning: 290, expenses: 160, nights: 24 },
  { paid: [1460, 1050, 780], pending: 620, rent: 1450, cleaning: 340, expenses: 205, nights: 26 },
  { paid: [1580, 1180, 890], pending: 540, rent: 1450, cleaning: 320, expenses: 230, nights: 25 }
];

const GUESTS = [
  ["Sofia Bennett", "Daniel Foster", "Maya Collins", "Noah Parker"],
  ["Amelia Stone", "Lucas Martin", "Chloe Adams", "Ethan Brooks"],
  ["Olivia Carter", "Leo Wilson", "Nina Cooper", "Adam Reed"],
  ["Emma Laurent", "James Miller", "Lina Moore", "Oscar Hill"],
  ["Ava Morgan", "Theo Clark", "Mia Turner", "Liam Scott"],
  ["Elena Rossi", "Julian Hayes", "Camille Wright", "Sam Taylor"]
];

const EXPENSES = [
  ["Guest supplies", 74, 6],
  ["Replacement towels", 68, 13],
  ["Kitchen essentials", 88, 18]
];

export function createVideoDemoData(currentMonth) {
  const months = Array.from({ length: 6 }, (_, index) => moveMonth(currentMonth, index - 5));
  const bookingsByMonth = {};
  const statsByMonth = {};

  months.forEach((month, index) => {
    const profile = MONTH_PROFILES[index];
    const names = GUESTS[index];
    const bookings = [
      booking(month, 1, names[0], 2, 7, profile.paid[0], "paid"),
      booking(month, 2, names[1], 9, 14, profile.paid[1], "paid"),
      booking(month, 3, names[2], 17, 22, profile.paid[2], "paid")
    ];
    if (profile.pending) bookings.push(booking(month, 4, names[3], 24, 28, profile.pending, "unpaid"));

    const randomExpenses = index === months.length - 1
      ? EXPENSES.map(([description, amount, day], expenseIndex) => ({
          id: `video-demo-expense-${expenseIndex}`,
          description,
          amount,
          date: dateInMonth(month, day),
          createdAt: `${dateInMonth(month, day)}T${10 + expenseIndex * 2}:30:00`
        }))
      : [{
          id: `video-demo-expense-${month}`,
          description: "Property supplies",
          amount: profile.expenses,
          date: dateInMonth(month, 12),
          createdAt: `${dateInMonth(month, 12)}T11:15:00`
        }];
    const paidRevenue = profile.paid.reduce((total, amount) => total + amount, 0);

    bookingsByMonth[month] = bookings;
    statsByMonth[month] = {
      month,
      rent: profile.rent,
      cleaning: profile.cleaning,
      randomExpenses,
      expenses: profile.expenses,
      totalRevenue: paidRevenue,
      unpaidRevenue: profile.pending,
      pendingPayouts: [],
      occupancyNights: profile.nights,
      occupancyRate: Math.round((profile.nights / monthDays(month)) * 100),
      netRevenue: paidRevenue - profile.rent - profile.cleaning - profile.expenses,
      pendingSync: false
    };
  });

  return {
    propertyName: "Harbor House",
    bookingsByMonth,
    statsByMonth,
    statsMonths: months.map((month) => statsByMonth[month])
  };
}
