CREATE TABLE public.client_accounts (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 organization_id uuid NOT NULL REFERENCES public.organizations(id),
 account_type text NOT NULL CHECK (account_type IN ('property_admin','independent_owner')),
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.client_accounts TO authenticated;
GRANT ALL ON public.client_accounts TO service_role;
ALTER TABLE public.client_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts own or general admin read" ON public.client_accounts FOR SELECT TO authenticated USING (user_id=auth.uid() OR public.has_global_role(auth.uid(),'superadmin'));
INSERT INTO public.client_accounts(user_id,organization_id,account_type)
SELECT DISTINCT ON (m.user_id) m.user_id,m.organization_id,
 CASE WHEN lower(p.email)='david.elghanayan@gmail.com' THEN 'independent_owner' ELSE 'property_admin' END
FROM public.organization_members m JOIN public.profiles p ON p.id=m.user_id
WHERE m.role='admin' AND NOT public.has_global_role(m.user_id,'superadmin') ORDER BY m.user_id,m.created_at,m.id;

CREATE TABLE public.organization_subscriptions (
 organization_id uuid PRIMARY KEY REFERENCES public.organizations(id),
 status text NOT NULL DEFAULT 'not_configured' CHECK(status IN ('not_configured','trial','active','past_due','canceled')),
 plan_name text,
 monthly_amount numeric CHECK(monthly_amount >= 0),
 currency public.currency NOT NULL DEFAULT 'CLP',
 current_period_end date,
 notes text,
 updated_by uuid,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE ON public.organization_subscriptions TO authenticated;
GRANT ALL ON public.organization_subscriptions TO service_role;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscriptions scoped read" ON public.organization_subscriptions FOR SELECT TO authenticated USING(public.is_org_member(organization_id));
CREATE POLICY "subscriptions general admin insert" ON public.organization_subscriptions FOR INSERT TO authenticated WITH CHECK(public.has_global_role(auth.uid(),'superadmin'));
CREATE POLICY "subscriptions general admin update" ON public.organization_subscriptions FOR UPDATE TO authenticated USING(public.has_global_role(auth.uid(),'superadmin')) WITH CHECK(public.has_global_role(auth.uid(),'superadmin'));

CREATE TABLE public.account_admin_audit (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, organization_id uuid,
 action text NOT NULL, before_value jsonb, after_value jsonb, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.account_admin_audit TO authenticated;
GRANT ALL ON public.account_admin_audit TO service_role;
ALTER TABLE public.account_admin_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit general admin read" ON public.account_admin_audit FOR SELECT TO authenticated USING(public.has_global_role(auth.uid(),'superadmin'));
CREATE FUNCTION public.audit_subscription_change() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
 NEW.updated_by:=auth.uid(); NEW.updated_at:=now();
 INSERT INTO public.account_admin_audit(actor_id,organization_id,action,before_value,after_value)
 VALUES(auth.uid(),NEW.organization_id,'subscription.'||lower(TG_OP),CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE NULL END,to_jsonb(NEW));
 RETURN NEW;
END; $$;
CREATE TRIGGER subscription_audit BEFORE INSERT OR UPDATE ON public.organization_subscriptions FOR EACH ROW EXECUTE FUNCTION public.audit_subscription_change();

ALTER POLICY "members: self insert on org create" ON public.organization_members WITH CHECK(false);
ALTER POLICY "members: admin manage" ON public.organization_members USING(public.has_org_role(organization_id,'admin')) WITH CHECK(public.has_org_role(organization_id,'admin') AND role <> 'superadmin');
ALTER POLICY "orgs: creator insert" ON public.organizations WITH CHECK(false);
CREATE POLICY "profiles general admin read" ON public.profiles FOR SELECT TO authenticated USING(public.has_global_role(auth.uid(),'superadmin'));
CREATE POLICY "profiles general admin support" ON public.profiles FOR UPDATE TO authenticated USING(public.has_global_role(auth.uid(),'superadmin')) WITH CHECK(public.has_global_role(auth.uid(),'superadmin'));

CREATE OR REPLACE FUNCTION public.create_org_for_current_user(_name text) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); existing uuid; new_id uuid;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF public.has_global_role(uid,'superadmin') THEN RETURN NULL; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 SELECT organization_id INTO existing FROM public.organization_members WHERE user_id=uid ORDER BY created_at,id LIMIT 1;
 IF existing IS NOT NULL THEN RETURN existing; END IF;
 INSERT INTO public.organizations(name,country,default_currency,created_by) VALUES(COALESCE(NULLIF(btrim(_name),''),'Mi patrimonio'),'CL','CLP',uid) RETURNING id INTO new_id;
 INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(new_id,uid,'admin');
 RETURN new_id;
END; $$;
REVOKE ALL ON FUNCTION public.create_org_for_current_user(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_org_for_current_user(text) TO authenticated,service_role;

CREATE FUNCTION public.complete_client_setup(_account_type text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); org uuid; org_name text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 IF _account_type IS NULL OR _account_type NOT IN ('property_admin','independent_owner') THEN RAISE EXCEPTION 'invalid client type'; END IF;
 IF public.has_global_role(uid,'superadmin') THEN RAISE EXCEPTION 'general administrator is not a subscriber'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text,0));
 IF EXISTS(SELECT 1 FROM public.client_accounts WHERE user_id=uid) THEN RETURN; END IF;
 SELECT organization_id INTO org FROM public.organization_members WHERE user_id=uid AND role='admin' ORDER BY created_at,id LIMIT 1;
 IF org IS NULL AND EXISTS(SELECT 1 FROM public.organization_members WHERE user_id=uid) THEN RAISE EXCEPTION 'only client administrators can choose an account type'; END IF;
 SELECT raw_user_meta_data->>'organization_name' INTO org_name FROM auth.users WHERE id=uid;
 IF org IS NULL THEN org:=public.create_org_for_current_user(org_name); END IF;
 INSERT INTO public.client_accounts(user_id,organization_id,account_type) VALUES(uid,org,_account_type);
END; $$;
REVOKE ALL ON FUNCTION public.complete_client_setup(text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.complete_client_setup(text) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE new_org_id uuid; display_name text; org_name text; client_type text;
BEGIN
 display_name:=COALESCE(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name',split_part(NEW.email,'@',1));
 org_name:=COALESCE(NULLIF(btrim(NEW.raw_user_meta_data->>'organization_name'),''),'Mi patrimonio');
 INSERT INTO public.profiles(id,full_name,email,phone) VALUES(NEW.id,display_name,NEW.email,NEW.raw_user_meta_data->>'phone') ON CONFLICT(id) DO NOTHING;
 SELECT organization_id INTO new_org_id FROM public.organization_members WHERE user_id=NEW.id ORDER BY created_at,id LIMIT 1;
 IF new_org_id IS NULL THEN
  INSERT INTO public.organizations(name,country,default_currency,created_by) VALUES(org_name,'CL','CLP',NEW.id) RETURNING id INTO new_org_id;
  INSERT INTO public.organization_members(organization_id,user_id,role) VALUES(new_org_id,NEW.id,'admin');
 END IF;
 client_type:=NEW.raw_user_meta_data->>'account_type';
 IF client_type IN ('property_admin','independent_owner') THEN
  INSERT INTO public.client_accounts(user_id,organization_id,account_type) VALUES(NEW.id,new_org_id,client_type) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN NEW;
END; $$;

CREATE FUNCTION public.get_account_context() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); kind text; org uuid; display_name text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
 SELECT full_name INTO display_name FROM public.profiles WHERE id=uid;
 IF public.has_global_role(uid,'superadmin') THEN kind:='general_admin';
 ELSE
  SELECT account_type,organization_id INTO kind,org FROM public.client_accounts WHERE user_id=uid;
  IF org IS NULL THEN
   SELECT m.organization_id,a.account_type INTO org,kind FROM public.organization_members m LEFT JOIN public.client_accounts a ON a.organization_id=m.organization_id WHERE m.user_id=uid ORDER BY m.created_at,m.id LIMIT 1;
  END IF;
 END IF;
 RETURN jsonb_build_object('user_id',uid,'account_type',kind,'organization_id',org,'full_name',COALESCE(display_name,''));
END; $$;
REVOKE ALL ON FUNCTION public.get_account_context() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_account_context() TO authenticated,service_role;

CREATE FUNCTION public.general_admin_overview() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF NOT public.has_global_role(auth.uid(),'superadmin') THEN RAISE EXCEPTION 'forbidden'; END IF;
 RETURN jsonb_build_object(
 'organizations',(SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT o.*, (SELECT count(*) FROM public.properties p WHERE p.organization_id=o.id) AS properties_count,(SELECT count(*) FROM public.rentable_units u WHERE u.organization_id=o.id) AS units_count FROM public.organizations o ORDER BY o.name) t),
 'clients',(SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT a.*,p.full_name,p.email FROM public.client_accounts a JOIN public.profiles p ON p.id=a.user_id ORDER BY p.full_name) t),
 'members',(SELECT COALESCE(jsonb_agg(to_jsonb(t)),'[]') FROM (SELECT m.*,p.full_name,p.email FROM public.organization_members m LEFT JOIN public.profiles p ON p.id=m.user_id ORDER BY m.created_at) t),
 'subscriptions',(SELECT COALESCE(jsonb_agg(to_jsonb(s)),'[]') FROM public.organization_subscriptions s));
END; $$;
REVOKE ALL ON FUNCTION public.general_admin_overview() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.general_admin_overview() TO authenticated,service_role;