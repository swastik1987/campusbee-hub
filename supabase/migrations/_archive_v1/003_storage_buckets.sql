-- ============================================================
-- STORAGE BUCKETS
-- ============================================================

-- Avatars: user profile pictures (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Class images: cover images and gallery (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('class-images', 'class-images', true);

-- Provider media: photos, intro videos, UPI QR images (public read)
INSERT INTO storage.buckets (id, name, public) VALUES ('provider-media', 'provider-media', true);

-- Payment screenshots: proof of payment (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-screenshots', 'payment-screenshots', false);

-- Class materials: documents, notes by providers (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('class-materials', 'class-materials', false);

-- Invoices: generated commission invoice PDFs (private)
INSERT INTO storage.buckets (id, name, public) VALUES ('invoices', 'invoices', false);

-- ============================================================
-- STORAGE POLICIES
-- ============================================================

-- Avatars: anyone can read, authenticated users upload their own
CREATE POLICY "Anyone can read avatars" ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');
CREATE POLICY "Users upload own avatar" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users update own avatar" ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users delete own avatar" ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Class images: anyone can read, providers upload
CREATE POLICY "Anyone can read class images" ON storage.objects FOR SELECT
  USING (bucket_id = 'class-images');
CREATE POLICY "Providers upload class images" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'class-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers update class images" ON storage.objects FOR UPDATE
  USING (bucket_id = 'class-images' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers delete class images" ON storage.objects FOR DELETE
  USING (bucket_id = 'class-images' AND auth.uid() IS NOT NULL);

-- Provider media: anyone can read, providers upload
CREATE POLICY "Anyone can read provider media" ON storage.objects FOR SELECT
  USING (bucket_id = 'provider-media');
CREATE POLICY "Providers upload provider media" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'provider-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers update provider media" ON storage.objects FOR UPDATE
  USING (bucket_id = 'provider-media' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers delete provider media" ON storage.objects FOR DELETE
  USING (bucket_id = 'provider-media' AND auth.uid() IS NOT NULL);

-- Payment screenshots: authenticated users only
CREATE POLICY "Users read own payment screenshots" ON storage.objects FOR SELECT
  USING (bucket_id = 'payment-screenshots' AND auth.uid() IS NOT NULL);
CREATE POLICY "Users upload payment screenshots" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'payment-screenshots' AND auth.uid() IS NOT NULL);

-- Class materials: authenticated users only
CREATE POLICY "Users read class materials" ON storage.objects FOR SELECT
  USING (bucket_id = 'class-materials' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers upload class materials" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'class-materials' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers update class materials" ON storage.objects FOR UPDATE
  USING (bucket_id = 'class-materials' AND auth.uid() IS NOT NULL);
CREATE POLICY "Providers delete class materials" ON storage.objects FOR DELETE
  USING (bucket_id = 'class-materials' AND auth.uid() IS NOT NULL);

-- Invoices: authenticated users only
CREATE POLICY "Users read invoices" ON storage.objects FOR SELECT
  USING (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);
CREATE POLICY "System upload invoices" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'invoices' AND auth.uid() IS NOT NULL);
