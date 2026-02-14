import { NextResponse } from 'next/server';

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || '';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

export async function POST() {
  if (!HA_URL || !HA_TOKEN) {
    return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 500 });
  }

  try {
    // Trigger the HA script that reloads the Apple TV integration and sends sleep.
    // The script runs inside HA (no tunnel timeout issues) and handles:
    // 1. Reload config entry (fixes stale integration that reports "off" when TV is on)
    // 2. Wait 5s for reconnection
    // 3. Send remote.turn_off to sleep the TV
    const response = await fetch(`${HA_URL}/api/services/script/turn_on`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ entity_id: 'script.sleep_apple_tv' }),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Home Assistant returned ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Apple TV sleep error:', error);
    return NextResponse.json({ error: 'Failed to sleep Apple TV' }, { status: 502 });
  }
}
