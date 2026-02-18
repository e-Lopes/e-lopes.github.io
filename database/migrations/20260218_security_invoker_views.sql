-- Fix Supabase Security Advisor findings for SECURITY DEFINER views.
-- Force views to execute with the querying user permissions/RLS context.

ALTER VIEW public.v_podium SET (security_invoker = true);
ALTER VIEW public.v_meta_by_month SET (security_invoker = true);
ALTER VIEW public.v_player_ranking SET (security_invoker = true);
ALTER VIEW public.v_deck_representation SET (security_invoker = true);
ALTER VIEW public.v_podium_full SET (security_invoker = true);
ALTER VIEW public.v_deck_stats SET (security_invoker = true);
ALTER VIEW public.v_store_champions SET (security_invoker = true);
ALTER VIEW public.v_monthly_ranking SET (security_invoker = true);
