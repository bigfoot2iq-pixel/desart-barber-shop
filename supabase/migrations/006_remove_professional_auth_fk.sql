-- Remove FK constraint from professionals.id -> profiles.id
-- so professionals can be created without needing an auth.users entry
ALTER TABLE public.professionals DROP CONSTRAINT IF EXISTS professionals_id_fkey;
