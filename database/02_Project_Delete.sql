-- Run in Supabase SQL Editor. This adds project deletion controls;
-- it does not delete any project when installed.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='120s';

DO $$
BEGIN
    IF to_regprocedure('public.whh_require_partner_admin()') IS NULL THEN
        RAISE EXCEPTION 'Run 01_Admin_And_Other.sql first to install the active-admin role check.';
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.whh_check_project_links(p_project_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record; linked boolean;
BEGIN
    FOR r IN
        SELECT c.oid,n.nspname AS schema_name,t.relname AS table_name,
            string_agg(format('child.%I = parent.%I',a.attname,b.attname),' AND ' ORDER BY k.ord) AS join_sql
        FROM pg_catalog.pg_constraint c
        JOIN pg_catalog.pg_class t ON t.oid=c.conrelid
        JOIN pg_catalog.pg_namespace n ON n.oid=t.relnamespace
        CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(local_num,remote_num,ord)
        JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.local_num
        JOIN pg_catalog.pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.remote_num
        WHERE c.contype='f' AND c.confrelid='public.projects'::regclass
        GROUP BY c.oid,n.nspname,t.relname ORDER BY n.nspname,t.relname,c.oid
    LOOP
        EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',r.schema_name,r.table_name);
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I child JOIN public.projects parent ON %s WHERE parent.project_id=$1)',r.schema_name,r.table_name,r.join_sql)
        INTO linked USING p_project_id;
        IF linked THEN
            RAISE EXCEPTION 'Project has linked records in %.%. Deletion is blocked. Use Edit project to change its status if it is no longer active.',r.schema_name,r.table_name USING ERRCODE='23503';
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.whh_guard_project_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    IF NOT (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin')) THEN
        PERFORM public.whh_require_partner_admin();
    END IF;
    PERFORM public.whh_check_project_links(OLD.project_id);
    RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS whh_project_delete_guard ON public.projects;
CREATE TRIGGER whh_project_delete_guard BEFORE DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.whh_guard_project_delete();

CREATE OR REPLACE FUNCTION public.whh_delete_unlinked_project(p_project_id bigint,p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE expected_confirmation text;
BEGIN
    PERFORM public.whh_require_partner_admin();
    PERFORM set_config('lock_timeout','5s',true);
    PERFORM public.whh_check_project_links(p_project_id);
    SELECT coalesce(nullif(btrim(project_code),''),btrim(project_name))
    INTO expected_confirmation FROM public.projects WHERE project_id=p_project_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Project no longer exists.'; END IF;
    IF p_confirmation IS NULL OR btrim(p_confirmation) IS DISTINCT FROM expected_confirmation THEN
        RAISE EXCEPTION 'The confirmation does not match the current project code or name.';
    END IF;
    DELETE FROM public.projects WHERE project_id=p_project_id;
    RETURN jsonb_build_object('deleted_project_id',p_project_id);
END $$;

REVOKE ALL ON FUNCTION public.whh_check_project_links(bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_guard_project_delete() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_delete_unlinked_project(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whh_delete_unlinked_project(bigint,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
