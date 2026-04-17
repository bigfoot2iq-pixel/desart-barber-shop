-- Create a private schema for security definer functions
CREATE SCHEMA IF NOT EXISTS auth_hooks;

-- Function to set default role on user creation
CREATE OR REPLACE FUNCTION auth_hooks.set_user_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = auth, public
AS $$
BEGIN
  -- Set default role to 'customer' for new users
  NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || '{"role": "customer"}'::jsonb;
  RETURN NEW;
END;
$$;

-- Trigger to auto-assign customer role on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  BEFORE INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auth_hooks.set_user_role();
