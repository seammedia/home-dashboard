import { NextResponse } from 'next/server';

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || '';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

export async function GET() {
  if (!HA_URL || !HA_TOKEN) {
    return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 500 });
  }

  try {
    // Read the command_line sensor that polls atvremote power_state every 30s
    const response = await fetch(`${HA_URL}/api/states/sensor.apple_tv_power`, {
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Home Assistant returned ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      state: data.state, // 'on', 'off', or 'unknown'
      last_updated: data.last_updated,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Apple TV state error:', error);
    return NextResponse.json({ error: 'Failed to get Apple TV state' }, { status: 502 });
  }
}
