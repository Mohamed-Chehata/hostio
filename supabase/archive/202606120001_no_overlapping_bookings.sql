create extension if not exists btree_gist;

alter table public.bookings
  drop constraint if exists no_overlapping_bookings;

alter table public.bookings
  add constraint no_overlapping_bookings
  exclude using gist (
    property_id with =,
    daterange(check_in, check_out, '[)') with &&
  )
  where (status is distinct from 'cancelled');
