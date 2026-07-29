CREATE OR REPLACE FUNCTION public.create_org_for_current_user(_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  existing uuid;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT organization_id INTO existing
  FROM public.organization_members
  WHERE user_id = uid
  ORDER BY created_at ASC
  LIMIT 1;

  IF existing IS NOT NULL THEN
    RETURN existing;
  END IF;

  INSERT INTO public.organizations (name, country, default_currency, created_by)
  VALUES (COALESCE(NULLIF(btrim(_name), ''), 'Mi Cartera'), 'CL', 'CLP', uid)
  RETURNING id INTO new_id;

  INSERT INTO public.organization_members (organization_id, user_id, role)
  VALUES (new_id, uid, 'admin');

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_org_for_current_user(text) FROM public;
GRANT EXECUTE ON FUNCTION public.create_org_for_current_user(text) TO authenticated;