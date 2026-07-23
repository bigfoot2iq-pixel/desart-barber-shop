-- Optional tip the customer adds for the professional at booking time.
-- Kept separate from total_price_mad (service + travel fee) so shop revenue
-- reporting stays intact and the professional's tip is tracked distinctly.
alter table public.appointments
  add column tip_mad int not null default 0
  check (tip_mad >= 0);
