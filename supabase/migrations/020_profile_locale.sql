alter table public.profiles
  add column locale text not null default 'fr'
  check (locale in ('fr', 'en'));
