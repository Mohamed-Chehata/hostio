const monthlySource = [
  { month: "2025-01", bookingCount: 13, rent: 2150, cleaning: 325, randomExpenses: [{ id: "2025-01-exp-1", description: "Supplies", amount: 178.75, date: "2025-01-14", createdAt: "2025-01-14T14:32:00" }], expenses: 178.75, totalRevenue: 3089, occupancyNights: 27, occupancyRate: 87, netRevenue: 435.31 },
  { month: "2025-02", bookingCount: 18, rent: 2150, cleaning: 375, randomExpenses: [], expenses: 0, totalRevenue: 2923, occupancyNights: 25, occupancyRate: 89, netRevenue: 398.81 },
  { month: "2025-03", bookingCount: 7, rent: 2150, cleaning: 375, randomExpenses: [], expenses: 0, totalRevenue: 3251, occupancyNights: 27, occupancyRate: 87, netRevenue: 726.37 },
  { month: "2025-04", bookingCount: 13, rent: 2150, cleaning: 325, randomExpenses: [], expenses: 0, totalRevenue: 2106, occupancyNights: 18, occupancyRate: 60, netRevenue: -368.94 },
  { month: "2025-05", bookingCount: 15, rent: 2150, cleaning: 375, randomExpenses: [], expenses: 0, totalRevenue: 2438, occupancyNights: 23, occupancyRate: 74, netRevenue: -86.42 },
  { month: "2025-06", bookingCount: 17, rent: 2150, cleaning: 425, randomExpenses: [], expenses: 0, totalRevenue: 3320, occupancyNights: 26, occupancyRate: 87, netRevenue: 745.31 },
  { month: "2025-07", bookingCount: 12, rent: 2150, cleaning: 300, randomExpenses: [], expenses: 0, totalRevenue: 5498, occupancyNights: 24, occupancyRate: 77, netRevenue: 3048.28 }
];

const guests = [
  "Sofia Bennett", "Noah Williams", "Emma Clarke", "Lucas Martin", "Mia Wilson",
  "Ethan Moore", "Amelia Taylor", "Leo Anderson", "Chloe Harris", "Henry Walker",
  "Isla Thompson", "James Rivera", "Lily Cooper", "Oliver Wright", "Ava Turner",
  "Theo Scott", "Nora Hill", "Jack Green"
];

function distribute(total, count) {
  const base = Math.floor(total / count);
  const result = Array(count).fill(base);
  let remainder = total - base * count;
  let index = 0;
  while (remainder > 0) {
    result[index] += 1;
    remainder -= 1;
    index = (index + 1) % count;
  }
  return result;
}

function buildBookings(summary, monthIndex) {
  const nights = distribute(summary.occupancyNights, summary.bookingCount);
  const revenue = distribute(summary.totalRevenue, summary.bookingCount);
  let day = 1;
  return revenue.map((amount, index) => {
    const checkInDay = Math.min(day, 27);
    const checkoutDay = Math.min(checkInDay + nights[index], 30);
    day += Math.max(1, nights[index]);
    return {
      id: `${summary.month}-${index + 1}`,
      guestName: guests[(monthIndex * 3 + index) % guests.length],
      checkIn: `${summary.month}-${String(checkInDay).padStart(2, "0")}`,
      checkOut: `${summary.month}-${String(checkoutDay).padStart(2, "0")}`,
      nights: nights[index],
      revenue: amount,
      rating: index % 4 === 0 ? null : 4 + (index % 3 === 0 ? 0 : 1),
      status: index % 5 === 0 ? "Unpaid" : "Paid"
    };
  });
}

export const monthlyStats = monthlySource.map(({ bookingCount, ...summary }) => summary);
export const initialBookings = monthlySource.flatMap((summary, index) => buildBookings(summary, index));
