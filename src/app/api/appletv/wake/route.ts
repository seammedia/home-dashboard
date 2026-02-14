import { NextResponse } from 'next/server';

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || '';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

export async function POST() {
  if (!HA_URL || !HA_TOKEN) {
    return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`${HA_URL}/api/services/shell_command/appletv_wake`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Home Assistant returned ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Apple TV wake error:', error);
    return NextResponse.json({ error: 'Failed to wake Apple TV' }, { status: 502 });
  }
}
