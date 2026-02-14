import { NextRequest, NextResponse } from 'next/server';

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || '';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

// Map camera IDs to Home Assistant entity IDs
const CAMERA_ENTITIES: Record<string, string> = {
  garage: 'camera.host_docker_internal',
  driveway: 'camera.host_docker_internal_2',
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const entityId = CAMERA_ENTITIES[id];

  if (!entityId) {
    return NextResponse.json({ error: 'Camera not found' }, { status: 404 });
  }

  if (!HA_URL || !HA_TOKEN) {
    return NextResponse.json({ error: 'Home Assistant not configured' }, { status: 500 });
  }

  try {
    const response = await fetch(`${HA_URL}/api/camera_proxy/${entityId}`, {
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

    const buffer = await response.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Camera proxy error:', error);
    return NextResponse.json({ error: 'Failed to fetch camera' }, { status: 502 });
  }
}
