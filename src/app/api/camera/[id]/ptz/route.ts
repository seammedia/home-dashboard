import { NextRequest, NextResponse } from 'next/server';

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || '';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

// Map camera IDs to ONVIF entity IDs for PTZ control
const PTZ_ENTITIES: Record<string, string> = {
  garage: 'camera.garage_camera_mainstream',
  driveway: 'camera.driveway_camera_mainstream',
};

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entityId = PTZ_ENTITIES[id];

  if (!entityId) {
    return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  }

  if (!HA_URL || !HA_TOKEN) {
    return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { direction } = body;

    const ptzPayload: Record<string, unknown> = {
      entity_id: entityId,
      move_mode: 'ContinuousMove',
      continuous_duration: 0.5,
      speed: 0.5,
      distance: 0.3,
    };

    switch (direction) {
      case 'up':
        ptzPayload.tilt = 'UP';
        break;
      case 'down':
        ptzPayload.tilt = 'DOWN';
        break;
      case 'left':
        ptzPayload.pan = 'LEFT';
        break;
      case 'right':
        ptzPayload.pan = 'RIGHT';
        break;
      default:
        return NextResponse.json({ error: 'Invalid direction' }, { status: 400 });
    }

    const response = await fetch(`${HA_URL}/api/services/onvif/ptz`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${HA_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(ptzPayload),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Home Assistant returned ${response.status}` },
        { status: response.status }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('PTZ error:', error);
    return NextResponse.json({ error: 'Failed to control camera' }, { status: 502 });
  }
}
