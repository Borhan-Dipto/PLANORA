-- Cover every new foreign key (flagged by the performance advisor) with an index.
CREATE INDEX IF NOT EXISTS idx_activation_codes_created_by ON public.activation_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_plan_id ON public.focus_sessions(plan_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task_id ON public.focus_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_payment_requests_reviewed_by ON public.payment_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_activation_code_id ON public.subscriptions(activation_code_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_granted_by ON public.subscriptions(granted_by);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_request_id ON public.subscriptions(payment_request_id);

-- Pre-existing policies re-evaluated auth.uid() per row instead of once per query. Pure perf fix,
-- no behavior change: same policies, just wrapped so Postgres can treat it as a stable subquery.
DROP POLICY IF EXISTS profiles_select_own ON public.profiles;
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT USING (((select auth.uid()) = id) OR is_admin());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE USING (((select auth.uid()) = id) OR is_admin());

DROP POLICY IF EXISTS prefs_select_own ON public.user_preferences;
CREATE POLICY prefs_select_own ON public.user_preferences FOR SELECT USING (((select auth.uid()) = user_id) OR is_admin());

DROP POLICY IF EXISTS prefs_update_own ON public.user_preferences;
CREATE POLICY prefs_update_own ON public.user_preferences FOR UPDATE USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS prefs_insert_own ON public.user_preferences;
CREATE POLICY prefs_insert_own ON public.user_preferences FOR INSERT WITH CHECK ((select auth.uid()) = user_id);
