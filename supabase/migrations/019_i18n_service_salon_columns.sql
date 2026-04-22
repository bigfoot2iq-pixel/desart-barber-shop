alter table public.services
  add column name_fr text,
  add column description_fr text;

alter table public.salons
  add column name_fr text,
  add column address_fr text;
