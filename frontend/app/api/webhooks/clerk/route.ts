import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';
import { getSupabaseServiceClient } from '@/lib/supabase';

/**
 * Next.js Route handler to receive Clerk Webhook triggers.
 * Automatically validates svix signatures to prevent fake payload attacks.
 * Syncs user profiles, organizations, and memberships directly to Supabase.
 */
export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    console.error('[Clerk Webhook]: CLERK_WEBHOOK_SECRET is missing. Skipping verification checks.');
    return new Response('Configuration error: Webhook secret is missing.', { status: 500 });
  }

  // 1. Get headers to parse svix signatures
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Missing svix signature headers.', { status: 400 });
  }

  // 2. Read body payload
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // 3. Verify signature using svix SDK
  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('[Clerk Webhook]: Failed signature verification', err);
    return new Response('Invalid webhook signature.', { status: 400 });
  }

  // 4. Extract event details and delegate
  const { type } = evt;
  console.log(`[Clerk Webhook]: Received event type: "${type}"`);

  // Obtain trusted database client bypassing RLS policies
  const supabase = getSupabaseServiceClient();

  try {
    switch (type) {
      case 'user.created': {
        const u = evt.data;
        const displayName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Developer';
        const { error } = await supabase
          .from('profiles')
          .insert({
            clerk_user_id: u.id,
            display_name: displayName,
            avatar_url: u.image_url || '',
          });
        if (error) throw error;
        break;
      }

      case 'user.updated': {
        const u = evt.data;
        const displayName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Developer';
        const { error } = await supabase
          .from('profiles')
          .update({
            display_name: displayName,
            avatar_url: u.image_url || '',
          })
          .eq('clerk_user_id', u.id);
        if (error) throw error;
        break;
      }

      case 'user.deleted': {
        const u = evt.data;
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('clerk_user_id', u.id);
        if (error) throw error;
        break;
      }

      case 'organization.created': {
        const org = evt.data as any;
        const { error } = await supabase
          .from('organizations')
          .insert({
            clerk_organization_id: org.id,
            name: org.name,
            slug: org.slug,
            logo_url: org.image_url || org.logo_url || '',
          });
        if (error) throw error;
        break;
      }

      case 'organization.updated': {
        const org = evt.data as any;
        const { error } = await supabase
          .from('organizations')
          .update({
            name: org.name,
            slug: org.slug,
            logo_url: org.image_url || org.logo_url || '',
          })
          .eq('clerk_organization_id', org.id);
        if (error) throw error;
        break;
      }

      case 'organizationMembership.created': {
        const memb = evt.data;
        // Mapped role logic
        const dbRole = memb.role === 'org:admin' ? 'admin' : 'member';
        
        // Find internal organizations id
        const { data: dbOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('clerk_organization_id', memb.organization.id)
          .maybeSingle();

        if (dbOrg) {
          const { error } = await supabase
            .from('organization_memberships')
            .insert({
              organization_id: dbOrg.id,
              clerk_user_id: memb.public_user_data.user_id,
              role: dbRole,
            });
          if (error) throw error;
        }
        break;
      }

      case 'organizationMembership.deleted': {
        const memb = evt.data;
        const { data: dbOrg } = await supabase
          .from('organizations')
          .select('id')
          .eq('clerk_organization_id', memb.organization.id)
          .maybeSingle();

        if (dbOrg) {
          const { error } = await supabase
            .from('organization_memberships')
            .delete()
            .eq('organization_id', dbOrg.id)
            .eq('clerk_user_id', memb.public_user_data.user_id);
          if (error) throw error;
        }
        break;
      }

      default:
        console.log(`[Clerk Webhook]: Unhandled event trigger: "${type}"`);
    }

    return new Response('Event processed.', { status: 200 });
  } catch (err: any) {
    console.error(`[Clerk Webhook Error]: Error processing event: "${type}"`, err);
    return new Response(`Internal processing error: ${err.message}`, { status: 500 });
  }
}
