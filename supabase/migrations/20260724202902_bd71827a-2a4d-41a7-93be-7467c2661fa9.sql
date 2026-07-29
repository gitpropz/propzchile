-- Ensure trigger runs handle_new_user on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill orgs/memberships for existing users who don't have any
DO $$
DECLARE
  u RECORD;
  new_org_id UUID;
  display_name TEXT;
BEGIN
  FOR u IN
    SELECT au.id, au.email, au.raw_user_meta_data
    FROM auth.users au
    WHERE NOT EXISTS (SELECT 1 FROM public.organization_members m WHERE m.user_id = au.id)
  LOOP
    display_name := COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', split_part(u.email, '@', 1));

    INSERT INTO public.profiles (id, full_name, email)
    VALUES (u.id, display_name, u.email)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.organizations (name, country, default_currency, created_by)
    VALUES (COALESCE(u.raw_user_meta_data->>'organization_name', 'Mi Cartera'), 'CL', 'CLP', u.id)
    RETURNING id INTO new_org_id;

    INSERT INTO public.organization_members (organization_id, user_id, role)
    VALUES (new_org_id, u.id, 'admin');
  END LOOP;
END $$;