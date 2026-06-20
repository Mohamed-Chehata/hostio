export const PLANS = {
  starter: { name: "Starter", price: 9, propertyLimit: 2, description: "For hosts getting started" },
  growth: { name: "Growth", price: 19, propertyLimit: 9, description: "For growing property portfolios" },
  pro: { name: "Pro", price: 39, propertyLimit: Infinity, description: "For unlimited property management" }
};

export const PRICING = {
  trialDays: 7
};

export function formatPlanPrice(plan) {
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency: plan.currency || "USD",
    maximumFractionDigits: Number.isInteger(plan.price) ? 0 : 2
  }).format(plan.price);
}
