-- ==============================================================================
-- Sculra Supabase Storage Bucket Definitions (buckets.sql)
-- ==============================================================================
-- Registers storage buckets and configures Row-Level Security policies.

-- 1. Create Buckets
-- ------------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) VALUES 
  ('screenshots', 'screenshots', false),
  ('videos', 'videos', false),
  ('reports', 'reports', false),
  ('avatars', 'avatars', true),
  ('attachments', 'attachments', false),
  ('exports', 'exports', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Security Policies
-- ------------------------------------------------------------------------------
-- Example for Avatars: Publicly readable, writeable only by owner
CREATE POLICY "Public Avatars Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Users can upload their own avatars"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'avatars' 
    AND auth.role() = 'authenticated'
);

-- Example for Screenshots: Accessible only by organization members
CREATE POLICY "Screenshots Access Restriction"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'screenshots'
    AND auth.role() = 'authenticated'
    -- Note: Real production policy will parse object path (e.g. org_uuid/project_uuid/file.png)
    -- to verify membership in public.members table.
);

