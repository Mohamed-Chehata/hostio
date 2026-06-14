-- Verified against the linked production project on 2026-06-12.
-- This baseline intentionally reflects the current schema: booking status is
-- limited to paid/unpaid and no overlap exclusion constraint is installed.

create table if not exists public.user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  currency text not null default 'EUR',
  currency_symbol text not null default '€',
  cost_label_1 text not null default 'Rent',
  cost_label_2 text not null default 'Cleaning',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'My Property',
  created_at timestamptz default now(),
  constraint properties_name_length_check
    check (char_length(trim(name)) between 1 and 100)
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_name text not null,
  check_in date not null,
  check_out date not null,
  nights integer not null,
  revenue numeric(10,2) not null default 0,
  rating integer,
  status text not null default 'paid',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint bookings_guest_name_length_check
    check (char_length(trim(guest_name)) between 1 and 200),
  constraint bookings_dates_check check (check_out > check_in),
  constraint bookings_nights_positive_check check (nights > 0),
  constraint bookings_revenue_nonnegative_check check (revenue >= 0),
  constraint bookings_rating_check check (rating between 1 and 5),
  constraint bookings_status_check check (status in ('paid', 'unpaid'))
);

create table if not exists public.monthly_costs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  month text not null,
  cost_1 numeric(10,2) not null default 0,
  cost_2 numeric(10,2) not null default 0,
  constraint monthly_costs_cost_1_nonnegative_check check (cost_1 >= 0),
  constraint monthly_costs_cost_2_nonnegative_check check (cost_2 >= 0),
  constraint monthly_costs_property_id_month_key unique (property_id, month)
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references public.properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  month text not null,
  description text not null,
  amount numeric(10,2) not null,
  expense_date date not null default current_date,
  expense_time time not null default current_time,
  created_at timestamptz default now(),
  constraint expenses_description_length_check
    check (char_length(trim(description)) between 1 and 200),
  constraint expenses_amount_nonnegative_check check (amount >= 0)
);

alter table public.user_settings enable row level security;
alter table public.properties enable row level security;
alter table public.bookings enable row level security;
alter table public.monthly_costs enable row level security;
alter table public.expenses enable row level security;

drop policy if exists "own data only" on public.user_settings;
create policy "own data only" on public.user_settings
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own data only" on public.properties;
create policy "own data only" on public.properties
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "own data only" on public.bookings;
create policy "own data only" on public.bookings
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.properties
      where properties.id = bookings.property_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.properties
      where properties.id = bookings.property_id
        and properties.user_id = auth.uid()
    )
  );

drop policy if exists "own data only" on public.monthly_costs;
create policy "own data only" on public.monthly_costs
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.properties
      where properties.id = monthly_costs.property_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.properties
      where properties.id = monthly_costs.property_id
        and properties.user_id = auth.uid()
    )
  );

drop policy if exists "own data only" on public.expenses;
create policy "own data only" on public.expenses
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from public.properties
      where properties.id = expenses.property_id
        and properties.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.properties
      where properties.id = expenses.property_id
        and properties.user_id = auth.uid()
    )
  );
