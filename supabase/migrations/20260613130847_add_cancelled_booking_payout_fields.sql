alter table public.bookings add column if not exists booking_status text not null default 'active' check (booking_status in ('active', 'cancelled'));
alter table public.bookings add column if not exists cancellation_payout_percent numeric;
alter table public.bookings add column if not exists cancellation_payout_available_at timestamptz;
alter table public.bookings add column if not exists original_revenue numeric;

create extension if not exists btree_gist;

alter table public.bookings drop constraint if exists no_overlapping_bookings;
alter table public.bookings add constraint no_overlapping_bookings
exclude using gist (
  property_id with =,
  daterange(check_in, check_out, '[)') with &&
)
where (booking_status <> 'cancelled');
