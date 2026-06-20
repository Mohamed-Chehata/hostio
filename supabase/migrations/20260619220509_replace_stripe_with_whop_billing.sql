alter table public.subscriptions
  add column if not exists billing_provider text not null default 'hostrack_trial'
    check (billing_provider in ('hostrack_trial', 'legacy_stripe', 'whop')),
  add column if not exists whop_user_id text unique,
  add column if not exists whop_membership_id text unique,
  add column if not exists whop_plan_id text,
  add column if not exists whop_manage_url text,
  add column if not exists cancel_at_period_end boolean not null default false;

update public.subscriptions
set billing_provider = 'legacy_stripe'
where stripe_customer_id is not null or stripe_subscription_id is not null;

create table if not exists public.whop_entitlements (
  whop_user_id text primary key,
  whop_membership_id text not null unique,
  hostrack_user_id uuid unique references auth.users(id) on delete set null,
  email text,
  plan text not null check (plan in ('starter', 'growth', 'pro')),
  whop_plan_id text not null,
  product_id text not null,
  company_id text not null,
  status text not null,
  current_period_end timestamptz,
  manage_url text,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
  provider text not null,
  event_id text not null,
  event_type text not null,
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

alter table public.whop_entitlements enable row level security;
alter table public.billing_webhook_events enable row level security;

revoke all on table public.whop_entitlements from anon, authenticated;
revoke all on table public.billing_webhook_events from anon, authenticated;

create index if not exists whop_entitlements_hostrack_user_idx
  on public.whop_entitlements (hostrack_user_id);

create index if not exists whop_entitlements_status_idx
  on public.whop_entitlements (status);
