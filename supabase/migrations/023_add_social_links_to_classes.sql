-- Migration 023: Add social link columns to classes
-- Run this once in the Supabase SQL editor or via Supabase CLI.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS facebook_url  TEXT,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT,
  ADD COLUMN IF NOT EXISTS twitter_url   TEXT;
