import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabaseServer';

// POST  /api/push/subscribe  — save a push subscription + reminder settings
export async function POST(req: NextRequest) {
  try {
    const { subscription, reminderTime, source } = await req.json();
    if (!subscription?.endpoint) {
      return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.from('push_subscriptions').upsert({
      endpoint:      subscription.endpoint,
      p256dh:        subscription.keys?.p256dh,
      auth_key:      subscription.keys?.auth,
      reminder_time: reminderTime,   // UTC "HH:MM"
      source:        source ?? 'smile', // 'smile' | 'office'
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'endpoint' });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/subscribe]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// DELETE  /api/push/subscribe  — remove a subscription
export async function DELETE(req: NextRequest) {
  try {
    const { endpoint } = await req.json();
    if (!endpoint) return NextResponse.json({ error: 'Missing endpoint' }, { status: 400 });

    const supabase = createServiceClient();
    await supabase.from('push_subscriptions').delete().eq('endpoint', endpoint);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[push/unsubscribe]', err);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
