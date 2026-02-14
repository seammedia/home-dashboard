import { NextResponse } from 'next/server';

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || '';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

const APPLE_TV_CONFIG_ENTRY_ID = '01KHD3PX3R0QCXENV5NH7M355F';

async function haFetch(endpoint: string, options: RequestInit = {}) {
  const response = await fetch(`${HA_URL}${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HA_TOKEN}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function POST() {
  if (!HA_URL || !HA_TOKEN) {
    return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 500 });
  }

  try {
    // Step 1: Reload the Apple TV integration so it reconnects.
    // The integration goes stale after the TV sleeps/wakes, reporting "off"
    // even when the TV is on. Reloading forces a fresh connection.
    await haFetch(
      `/api/config/config_entries/entry/${APPLE_TV_CONFIG_ENTRY_ID}/reload`,
      { method: 'POST' }
    );

    // Step 2: Wait for the integration to reconnect and discover the TV
    await sleep(3000);

    // Step 3: Send the sleep command via remote/turn_off
    const result = await haFetch('/api/services/remote/turn_off', {
      method: 'POST',
      body: JSON.stringify({ entity_id: 'remote.lounge_room' }),
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: `Home Assistant returned ${result.status}` },
        { status: result.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Apple TV sleep error:', error);
    return NextResponse.json({ error: 'Failed to sleep Apple TV' }, { status: 502 });
  }
}
