-- ============================================================
-- CampusBee — 017_moderation_gemini_provider.sql
--
-- The Phase 3 ai-moderate-content edge function uses Google
-- Gemini (not OpenAI) for text moderation, so the ai_provider
-- CHECK constraint on moderation_flags must include 'gemini'.
--
-- Safe to re-run (DROP + ADD is idempotent by name).
-- ============================================================

ALTER TABLE public.moderation_flags
  DROP CONSTRAINT IF EXISTS moderation_flags_ai_provider_check;

ALTER TABLE public.moderation_flags
  ADD CONSTRAINT moderation_flags_ai_provider_check
  CHECK (ai_provider IN ('sightengine', 'gemini', 'openai', 'manual'));
