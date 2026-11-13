DO $$ BEGIN
 IF NOT EXISTS (
 SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_proc p ON p.oid=t.tgfoid
 WHERE n.nspname='auth' AND c.relname='users' AND p.proname='handle_new_user' AND NOT t.tgisinternal
 ) THEN
 CREATE TRIGGER propz_account_after_signup AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
 END IF;
END; $$;