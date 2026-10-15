-- Run once in Supabase SQL Editor BEFORE uploading the updated JavaScript.
-- Adds description columns, missing Other lookup options, and guarded admin actions.
-- No entered records are removed by this migration.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';

ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS intervention_type_other text;
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS legal_status_other text;
ALTER TABLE public.project_budgets ADD COLUMN IF NOT EXISTS budget_type_other text;
ALTER TABLE public.capacity_assessments ADD COLUMN IF NOT EXISTS assessment_type_other text;
ALTER TABLE public.feedback_records ADD COLUMN IF NOT EXISTS feedback_from_other text;
ALTER TABLE public.feedback_records ADD COLUMN IF NOT EXISTS feedback_to_other text;

-- Preserve configured categories; add Other only where it is missing.
DO $$
DECLARE r record;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtext('whh_category_other_seed'));
    FOR r IN SELECT * FROM (VALUES
        ('partner_types','partner_type_name'),
        ('legal_statuses','legal_status_name'),
        ('partnership_types','partnership_type_name'),
        ('intervention_types','intervention_type_name'),
        ('capacity_domains','capacity_domain_name'),
        ('meeting_types','meeting_type_name'),
        ('feedback_mechanisms','feedback_mechanism_name'),
        ('sectors','sector_name'),
        ('budget_types','budget_type_name'),
        ('localization_characteristics','characteristic_name')
    ) AS x(table_name,name_column)
    LOOP
        EXECUTE format('INSERT INTO public.%I (%I) SELECT $1 WHERE NOT EXISTS (SELECT 1 FROM public.%I WHERE lower(btrim(%I)) = lower($1))',r.table_name,r.name_column,r.table_name,r.name_column) USING 'Other';
    END LOOP;
END $$;

-- Discover the actual app_users -> user_roles FK instead of guessing its column.
CREATE OR REPLACE FUNCTION public.whh_require_partner_admin()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE join_sql text; role_value text; fk_count integer;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in with an active admin account.' USING ERRCODE='42501'; END IF;
    SELECT count(*) INTO fk_count FROM pg_catalog.pg_constraint
    WHERE contype='f' AND conrelid='public.app_users'::regclass AND confrelid='public.user_roles'::regclass;
    IF fk_count <> 1 THEN RAISE EXCEPTION 'Expected one app_users to user_roles foreign key; ask the administrator to check the schema.'; END IF;
    SELECT string_agg(format('u.%I = r.%I',a.attname,b.attname),' AND ' ORDER BY k.ord)
    INTO join_sql
    FROM pg_catalog.pg_constraint c
    CROSS JOIN LATERAL unnest(c.conkey,c.confkey) WITH ORDINALITY k(local_num,remote_num,ord)
    JOIN pg_catalog.pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.local_num
    JOIN pg_catalog.pg_attribute b ON b.attrelid=c.confrelid AND b.attnum=k.remote_num
    WHERE c.contype='f' AND c.conrelid='public.app_users'::regclass AND c.confrelid='public.user_roles'::regclass;
    EXECUTE format('SELECT r.role_name FROM public.app_users u JOIN public.user_roles r ON %s WHERE u.auth_user_id=$1 AND u.is_active IS TRUE',join_sql)
    INTO role_value USING auth.uid();
    IF lower(btrim(coalesce(role_value,''))) NOT IN ('admin','administrator','system admin','system administrator') THEN
        RAISE EXCEPTION 'Only an active administrator can perform this action.' USING ERRCODE='42501';
    END IF;
END $$;

-- Every foreign key into partners is checked, including cascade links.
-- Locks prevent a concurrent insert into a checked child table during deletion.
CREATE OR REPLACE FUNCTION public.whh_check_partner_links(p_partner_id bigint)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
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
        WHERE c.contype='f' AND c.confrelid='public.partners'::regclass
        GROUP BY c.oid,n.nspname,t.relname ORDER BY n.nspname,t.relname,c.oid
    LOOP
        EXECUTE format('LOCK TABLE %I.%I IN SHARE ROW EXCLUSIVE MODE',r.schema_name,r.table_name);
        EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I child JOIN public.partners parent ON %s WHERE parent.partner_id=$1)',r.schema_name,r.table_name,r.join_sql)
        INTO linked USING p_partner_id;
        IF linked THEN
            RAISE EXCEPTION 'Partner has linked records in %.%. Deactivate it instead of deleting it.',r.schema_name,r.table_name USING ERRCODE='23503';
        END IF;
    END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.whh_guard_partner_admin()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
    -- Trusted SQL maintenance is permitted; browser/API calls require an admin.
    IF NOT (auth.uid() IS NULL AND session_user IN ('postgres','supabase_admin')) THEN
        PERFORM public.whh_require_partner_admin();
    END IF;
    IF TG_OP='DELETE' THEN
        PERFORM public.whh_check_partner_links(OLD.partner_id);
        RETURN OLD;
    END IF;
    RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS whh_partner_delete_guard ON public.partners;
CREATE TRIGGER whh_partner_delete_guard BEFORE DELETE ON public.partners FOR EACH ROW EXECUTE FUNCTION public.whh_guard_partner_admin();
DROP TRIGGER IF EXISTS whh_partner_status_guard ON public.partners;
CREATE TRIGGER whh_partner_status_guard BEFORE UPDATE OF partner_status,is_active ON public.partners FOR EACH ROW
WHEN (OLD.partner_status IS DISTINCT FROM NEW.partner_status OR OLD.is_active IS DISTINCT FROM NEW.is_active)
EXECUTE FUNCTION public.whh_guard_partner_admin();

CREATE OR REPLACE FUNCTION public.whh_set_partner_active(p_partner_id bigint,p_active boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
    PERFORM public.whh_require_partner_admin();
    IF p_active IS NULL THEN RAISE EXCEPTION 'Active status is required.'; END IF;
    UPDATE public.partners AS p SET is_active=p_active,partner_status=CASE WHEN p_active THEN 'Active' ELSE 'Inactive' END
    WHERE p.partner_id=p_partner_id RETURNING to_jsonb(p) INTO result;
    IF result IS NULL THEN RAISE EXCEPTION 'Partner no longer exists.'; END IF;
    RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.whh_delete_unlinked_partner(p_partner_id bigint,p_confirmation text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE partner_name_value text;
BEGIN
    PERFORM public.whh_require_partner_admin();
    PERFORM set_config('lock_timeout','5s',true);
    -- Check children before acquiring the partner row lock for this RPC.
    PERFORM public.whh_check_partner_links(p_partner_id);
    SELECT partner_name INTO partner_name_value FROM public.partners WHERE partner_id=p_partner_id FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Partner no longer exists.'; END IF;
    IF p_confirmation IS NULL OR btrim(p_confirmation) <> btrim(partner_name_value) THEN
        RAISE EXCEPTION 'The confirmation name does not match the current partner name.';
    END IF;
    DELETE FROM public.partners WHERE partner_id=p_partner_id;
    RETURN jsonb_build_object('deleted_partner_id',p_partner_id);
END $$;

-- Enforce new Other descriptions at database level as well as in the form.
CREATE OR REPLACE FUNCTION public.whh_validate_category_other()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE row_data jsonb := to_jsonb(NEW); category_name text; custom_value text;
BEGIN
    IF TG_ARGV[1]='text' THEN category_name := row_data->>TG_ARGV[0];
    ELSE
        EXECUTE format('SELECT %I FROM public.%I WHERE %I::text=$1',TG_ARGV[3],TG_ARGV[1],TG_ARGV[2])
        INTO category_name USING row_data->>TG_ARGV[0];
    END IF;
    custom_value := row_data->>TG_ARGV[4];
    IF lower(btrim(coalesce(category_name,'')))='other' AND (custom_value IS NULL OR btrim(custom_value)='') THEN
        RAISE EXCEPTION 'Please specify the Other category for %.',TG_ARGV[0] USING ERRCODE='23514';
    END IF;
    IF length(coalesce(custom_value,''))>200 THEN RAISE EXCEPTION 'Other description must be 200 characters or fewer.' USING ERRCODE='23514'; END IF;
    RETURN NEW;
END $$;
DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM (VALUES
        ('projects','intervention_type_id','intervention_types','intervention_type_id','intervention_type_name','intervention_type_other'),
        ('partners','legal_status_id','legal_statuses','legal_status_id','legal_status_name','legal_status_other'),
        ('project_budgets','budget_type_id','budget_types','budget_type_id','budget_type_name','budget_type_other'),
        ('capacity_assessments','assessment_type','text','','','assessment_type_other'),
        ('feedback_records','feedback_from','text','','','feedback_from_other'),
        ('feedback_records','feedback_to','text','','','feedback_to_other')
    ) x(table_name,category_column,lookup_table,id_column,name_column,other_column)
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I','whh_other_'||r.category_column,r.table_name);
        EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF %I,%I ON public.%I FOR EACH ROW EXECUTE FUNCTION public.whh_validate_category_other(%L,%L,%L,%L,%L)',
            'whh_other_'||r.category_column,r.category_column,r.other_column,r.table_name,r.category_column,r.lookup_table,r.id_column,r.name_column,r.other_column);
    END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.whh_require_partner_admin() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_check_partner_links(bigint) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_guard_partner_admin() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_validate_category_other() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_set_partner_active(bigint,boolean) FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.whh_delete_unlinked_partner(bigint,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.whh_set_partner_active(bigint,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.whh_delete_unlinked_partner(bigint,text) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;

-- Verify role labels. The functions above accept Admin, Administrator,
-- System Admin, and System Administrator (case-insensitive).
SELECT role_name FROM public.user_roles ORDER BY role_name;
