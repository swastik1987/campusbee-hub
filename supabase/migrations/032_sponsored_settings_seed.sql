-- ============================================================================
-- 032_sponsored_settings_seed.sql  (Phase 8)
--
-- Seed default platform_settings keys for sponsored + featured banner config.
-- All values are idempotent upserts; safe to re-run.
--
-- The admin can edit `sponsored.slots_per_category` on /platform/settings to
-- override the slot count for any specific category.  Shape:
--
--   {
--     "default": 3,
--     "<category_uuid>": 5,
--     "<category_uuid>": 7
--   }
--
-- The `_sponsored_slot_count` helper (migration 031) reads this map first,
-- falling back to `sponsored.slots_per_region` (legacy single int) then 3.
-- ============================================================================

-- Per-category slot count override (empty default — only "default" key).
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('sponsored.slots_per_category',
   '{"default": 3}'::jsonb,
   'Per-category sponsored slot count.  Map of category_id → int with optional "default" key.  Read by _sponsored_slot_count helper.')
ON CONFLICT (key) DO NOTHING;

-- Pricing placeholders.  MVP says "Contact admin for pricing" so these aren't
-- surfaced in the UI yet — kept as JSON so future versions can populate them.
INSERT INTO public.platform_settings (key, value, description) VALUES
  ('sponsored.pricing',
   '{"contact_admin": true}'::jsonb,
   'Sponsored listing pricing config.  contact_admin=true → UI shows "Contact admin for pricing" instead of a fixed price.'),
  ('featured_banner.pricing',
   '{"contact_admin": true, "home": null, "explore": null}'::jsonb,
   'Featured banner pricing config keyed by surface.  contact_admin=true → UI shows "Contact admin for pricing".')
ON CONFLICT (key) DO NOTHING;
