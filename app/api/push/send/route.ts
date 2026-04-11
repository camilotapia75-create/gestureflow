import { NextRequest, NextResponse } from 'next/server';
import webpush from 'web-push';
import { createServiceClient } from '@/lib/supabaseServer';

webpush.setVapidDetails(
  `mailto:${process.env.VAPID_EMAIL ?? 'admin@gestureflow.app'}`,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
);

const MESSAGES: Record<string, { title: string; body: string; url: string; tag: string }> = {
  smile: {
    title: 'Smile Quota Reminder 😊',
    body:  "You haven't hit your daily smile quota yet — open the app and smile!",
    url:   '/smile',
    tag:   'smile-quota',
  },
  office: {
    title: 'Posture Check ⚠️',
    body:  "Time to sit up straight! Enable your camera and check your posture.",
    url:   '/office',
    tag:   'office-posture',
  },
};

// GET  /api/push/send  — called by Vercel Cron every minute
// Also accepts POST for manual testing
export async function GET(req: NextRequest) {
  return sendReminders(req);
}
export async function POST(req: NextRequest) {
  return sendReminders(req);
}

async function sendReminders(req: NextRequest) {
  // Guard: require cron secret (set CRON_SECRET env var)
  const secret = req.headers.get('x-cron-secret') ?? req.headers.get('authorization')?.replace('Bearer ', '');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return NextResponse.json({ error: 'VAPID not configured' }, { status: 500 });
  }

  // Current UTC time — match subscriptions within a 2-minute window
  const now   = new Date();
  const hh    = String(now.getUTCHours()).padStart(2, '0');
  const mm    = String(now.getUTCMinutes()).padStart(2, '0');
  // Also check previous minute to handle cron jitter
  const prev  = new Date(now.getTime() - 60_000);
  const phh   = String(prev.getUTCHours()).padStart(2, '0');
  const pmm   = String(prev.getUTCMinutes()).padStart(2, '0');

  const supabase = createServiceClient();
  const { data: subs, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .in('reminder_time', [`${hh}:${mm}`, `${phh}:${pmm}`]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!subs || subs.length === 0) return NextResponse.json({ sent: 0, time: `${hh}:${mm}` });

  let sent = 0;
  const toDelete: string[] = [];

  await Promise.allSettled(subs.map(async sub => {
    const msg = MESSAGES[sub.source] ?? MESSAGES.smile;
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        JSON.stringify(msg),
      );
      sent++;
    } catch (err: unknown) {
      const statusCode = (err as { statusCode?: number }).statusCode;
      if (statusCode === 410 || statusCode === 404) {
        // Subscription expired — remove it
        toDelete.push(sub.endpoint);
      }
    }
  }));

  if (toDelete.length > 0) {
    await supabase.from('push_subscriptions').delete().in('endpoint', toDelete);
  }

  return NextResponse.json({ sent, checked: subs.length, time: `${hh}:${mm}` });
}
