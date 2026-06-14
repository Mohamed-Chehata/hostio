create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  status text not null default 'trialing'
    check (status in ('trialing', 'active', 'canceled', 'expired')),
  trial_ends_at timestamptz not null,
  current_period_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.subscriptions enable row level security;

drop policy if exists "own subscription only" on public.subscriptions;
create policy "own subscription only"
  on public.subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.subscriptions to authenticated;

insert into public.subscriptions (user_id, status, trial_ends_at)
select users.id, 'trialing', now() + interval '7 days'
from auth.users as users
where not exists (
  select 1
  from public.subscriptions
  where subscriptions.user_id = users.id
);
