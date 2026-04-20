create table public.appointment_reviews (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  professional_id uuid references public.professionals(id) on delete set null,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);

alter table public.appointment_reviews enable row level security;

create policy "reviews: customer read own"
  on public.appointment_reviews for select
  using (customer_id = auth.uid());

create policy "reviews: customer insert own for completed"
  on public.appointment_reviews for insert
  with check (
    customer_id = auth.uid()
    and exists (
      select 1 from public.appointments a
      where a.id = appointment_id
        and a.customer_id = auth.uid()
        and a.status = 'completed'
    )
  );

create policy "reviews: admin read all" on public.appointment_reviews for select
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

create policy "reviews: professional read own" on public.appointment_reviews for select
  using (professional_id = auth.uid());
