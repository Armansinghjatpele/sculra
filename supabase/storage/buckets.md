# Sculra Local Supabase Storage Buckets Configuration

Sculra utilizes Supabase Object Storage to manage large assets and test recordings. The following buckets must be declared in the local Supabase studio console:

1. **`screenshots`**: Stores pixel diff traces and layout audit captures.
2. **`videos`**: Stores Playwright video records demonstrating failed user flows.
3. **`reports`**: Stores compiled JSON/HTML summary audits for offline downloading.
4. **`avatars`**: Stores user profile photos.
5. **`attachments`**: Stores debug bundle archives.
6. **`exports`**: Stores user-triggered bulk test history exports.

---

## Access & Permissions Rules

- All storage buckets are secured via Row Level Security (RLS) policies.
- Anonymous reads are disabled for security-critical assets (`screenshots`, `videos`, `reports`, `exports`). Only authenticated organization members possess read permissions.
- Public reading is allowed solely for the `avatars` bucket.
