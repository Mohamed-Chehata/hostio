-- Hostio Supabase schema.
-- Users are handled by Supabase Auth automatically.

-- User settings (currency, custom category names)
create table user_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  currency text not null default 'EUR',
  currency_symbol text not null default '€',
  cost_label_1 text not null default 'Rent',
  cost_label_2 text not null default 'Cleaning',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Properties (one per user for now, expandable later)
create table properties (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null default 'My Property' check (char_length(trim(name)) between 1 and 100),
  created_at timestamptz default now()
);

-- Bookings
create table bookings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  guest_name text not null check (char_length(trim(guest_name)) between 1 and 200),
  check_in date not null,
  check_out date not null,
  nights integer not null check (nights > 0),
  revenue numeric(10,2) not null default 0 check (revenue >= 0),
  rating integer check (rating between 1 and 5),
  status text not null default 'paid' check (status in ('paid', 'unpaid')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (check_out > check_in)
);

-- Monthly costs (rent, cleaning -- one row per month per property)
create table monthly_costs (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  month text not null, -- format: "2025-07"
  cost_1 numeric(10,2) not null default 0 check (cost_1 >= 0), -- Rent or renamed
  cost_2 numeric(10,2) not null default 0 check (cost_2 >= 0), -- Cleaning or renamed
  unique(property_id, month)
);

-- Random expenses
create table expenses (
  id uuid primary key default gen_random_uuid(),
  property_id uuid references properties(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  month text not null, -- format: "2025-07"
  description text not null check (char_length(trim(description)) between 1 and 200),
  amount numeric(10,2) not null check (amount >= 0),
  expense_date date not null default current_date,
  expense_time time not null default current_time,
  created_at timestamptz default now()
);

-- Row Level Security -- enable on all tables
alter table user_settings enable row level security;
alter table properties enable row level security;
alter table bookings enable row level security;
alter table monthly_costs enable row level security;
alter table expenses enable row level security;

-- RLS policies -- users only see their own data
create policy "own data only" on user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data only" on properties for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own data only" on bookings for all
  using (
    auth.uid() = user_id
    and exists (select 1 from properties where properties.id = bookings.property_id and properties.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from properties where properties.id = bookings.property_id and properties.user_id = auth.uid())
  );

create policy "own data only" on monthly_costs for all
  using (
    auth.uid() = user_id
    and exists (select 1 from properties where properties.id = monthly_costs.property_id and properties.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from properties where properties.id = monthly_costs.property_id and properties.user_id = auth.uid())
  );

create policy "own data only" on expenses for all
  using (
    auth.uid() = user_id
    and exists (select 1 from properties where properties.id = expenses.property_id and properties.user_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from properties where properties.id = expenses.property_id and properties.user_id = auth.uid())
  );
