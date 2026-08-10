
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'patrol-media public read') THEN
    CREATE POLICY "patrol-media public read" ON storage.objects
      FOR SELECT USING (bucket_id = 'patrol-media');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'patrol-media authenticated upload') THEN
    CREATE POLICY "patrol-media authenticated upload" ON storage.objects
      FOR INSERT WITH CHECK (bucket_id = 'patrol-media');
  END IF;
END $$;

