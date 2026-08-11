import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { WebhookEvent } from '@clerk/nextjs/server';

/**
 * Next.js Route handler to receive Clerk Webhook triggers.
 * Automatically validates svix signatures to prevent fake payload attacks.
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

  try {
    switch (type) {
      case 'user.created':
        console.log('[Clerk Webhook]: User created', evt.data.id);
        // Future DB sync: insert user profile
        break;

      case 'user.updated':
        console.log('[Clerk Webhook]: User updated', evt.data.id);
        // Future DB sync: update profile metadata
        break;

      case 'user.deleted':
        console.log('[Clerk Webhook]: User deleted', evt.data.id);
        // Future DB sync: soft delete user
        break;

      case 'organization.created':
        console.log('[Clerk Webhook]: Organization created', evt.data.id);
        // Future DB sync: create tenant profile
        break;

      case 'organization.updated':
        console.log('[Clerk Webhook]: Organization updated', evt.data.id);
        // Future DB sync: update tenant details
        break;

      case 'organizationMembership.created':
        console.log('[Clerk Webhook]: Membership created', evt.data.id);
        // Future DB sync: insert role binding
        break;

      case 'organizationMembership.deleted':
        console.log('[Clerk Webhook]: Membership deleted', evt.data.id);
        // Future DB sync: delete role binding
        break;

      default:
        console.log(`[Clerk Webhook]: Unhandled event trigger: "${type}"`);
    }

    return new Response('Event processed.', { status: 200 });
  } catch (err) {
    console.error(`[Clerk Webhook Error]: Error processing event: "${type}"`, err);
    return new Response('Internal processing error.', { status: 500 });
  }
}
