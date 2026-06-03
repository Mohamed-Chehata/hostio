-- Hostio security hardening: ownership checks and backend validation.

drop policy if exists "own data only" on user_settings;
drop policy if exists "own data only" on properties;
drop policy if exists "own data only" on bookings;
drop policy if exists "own data only" on monthly_costs;
drop policy if exists "own data only" on expenses;

create policy "own data only" on user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data only" on properties
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "own data only" on bookings
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from properties
      where properties.id = bookings.property_id
      and properties.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties
      where properties.id = bookings.property_id
      and properties.user_id = auth.uid()
    )
  );

create policy "own data only" on monthly_costs
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from properties
      where properties.id = monthly_costs.property_id
      and properties.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties
      where properties.id = monthly_costs.property_id
      and properties.user_id = auth.uid()
    )
  );

create policy "own data only" on expenses
  for all
  using (
    auth.uid() = user_id
    and exists (
      select 1 from properties
      where properties.id = expenses.property_id
      and properties.user_id = auth.uid()
    )
  )
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from properties
      where properties.id = expenses.property_id
      and properties.user_id = auth.uid()
    )
  );

alter table properties
  drop constraint if exists properties_name_length_check,
  add constraint properties_name_length_check check (char_length(trim(name)) between 1 and 100);

alter table bookings
  drop constraint if exists bookings_guest_name_length_check,
  drop constraint if exists bookings_dates_check,
  drop constraint if exists bookings_nights_positive_check,
  drop constraint if exists bookings_revenue_nonnegative_check,
  add constraint bookings_guest_name_length_check check (char_length(trim(guest_name)) between 1 and 200),
  add constraint bookings_dates_check check (check_out > check_in),
  add constraint bookings_nights_positive_check check (nights > 0),
  add constraint bookings_revenue_nonnegative_check check (revenue >= 0);

alter table monthly_costs
  drop constraint if exists monthly_costs_cost_1_nonnegative_check,
  drop constraint if exists monthly_costs_cost_2_nonnegative_check,
  add constraint monthly_costs_cost_1_nonnegative_check check (cost_1 >= 0),
  add constraint monthly_costs_cost_2_nonnegative_check check (cost_2 >= 0);

alter table expenses
  drop constraint if exists expenses_description_length_check,
  drop constraint if exists expenses_amount_nonnegative_check,
  add constraint expenses_description_length_check check (char_length(trim(description)) between 1 and 200),
  add constraint expenses_amount_nonnegative_check check (amount >= 0);
