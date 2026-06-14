alter table public.bookings
  add column if not exists payment_override text
  check (payment_override in ('paid', 'unpaid') or payment_override is null);

update public.bookings
set payment_override = status
where payment_override is null
  and status in ('paid', 'unpaid');
