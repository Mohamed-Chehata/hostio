alter table public.subscriptions
  add column if not exists plan text
  check (plan in ('starter', 'growth', 'pro'));

alter table public.subscriptions
  add column if not exists needs_property_selection boolean not null default false;

alter table public.properties
  add column if not exists is_locked boolean not null default false;

drop policy if exists "own subscription only" on public.subscriptions;
drop policy if exists "read own subscription" on public.subscriptions;
drop policy if exists "create own subscription" on public.subscriptions;

create policy "read own subscription"
  on public.subscriptions
  for select
  using (auth.uid() = user_id);

create policy "create own subscription"
  on public.subscriptions
  for insert
  with check (auth.uid() = user_id);
