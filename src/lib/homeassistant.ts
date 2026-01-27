// Home Assistant API integration

const HA_URL = process.env.NEXT_PUBLIC_HA_URL || 'http://192.168.215.2:8123';
const HA_TOKEN = process.env.NEXT_PUBLIC_HA_TOKEN || '';

export interface Light {
  entity_id: string;
  name: string;
  state: 'on' | 'off';
  brightness: number; // 0-100
  color_temp?: number;
  rgb_color?: [number, number, number];
  supports_brightness: boolean;
  supports_color: boolean;
}

export interface HaState {
  entity_id: string;
  state: string;
  attributes: {
    friendly_name?: string;
    brightness?: number;
    color_temp?: number;
    rgb_color?: [number, number, number];
    supported_color_modes?: string[];
    [key: string]: unknown;
  };
}

async function haFetch(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('ha_token') || HA_TOKEN;
  const url = localStorage.getItem('ha_url') || HA_URL;

  if (!token) {
    throw new Error('No Home Assistant token configured');
  }

  // Debug: log what we're sending (token truncated for security)
  console.log('[HA Debug] URL:', url + endpoint);
  console.log('[HA Debug] Token length:', token.length);
  console.log('[HA Debug] Token starts with:', token.substring(0, 20) + '...');
  console.log('[HA Debug] Token ends with:', '...' + token.substring(token.length - 20));

  const response = await fetch(`${url}${endpoint}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  console.log('[HA Debug] Response status:', response.status);

  if (!response.ok) {
    throw new Error(`Home Assistant API error: ${response.status}`);
  }

  return response.json();
}

export async function testConnection(): Promise<boolean> {
  try {
    const result = await haFetch('/api/');
    return result.message === 'API running.';
  } catch {
    return false;
  }
}

export async function getLights(): Promise<Light[]> {
  const states: HaState[] = await haFetch('/api/states');
  
  return states
    .filter(s => s.entity_id.startsWith('light.'))
    .map(s => ({
      entity_id: s.entity_id,
      name: s.attributes.friendly_name || s.entity_id.replace('light.', '').replace(/_/g, ' '),
      state: s.state as 'on' | 'off',
      brightness: s.attributes.brightness ? Math.round((s.attributes.brightness / 255) * 100) : 0,
      color_temp: s.attributes.color_temp,
      rgb_color: s.attributes.rgb_color,
      supports_brightness: s.attributes.supported_color_modes?.some(m => 
        ['brightness', 'color_temp', 'xy', 'hs', 'rgb'].includes(m)
      ) ?? false,
      supports_color: s.attributes.supported_color_modes?.some(m => 
        ['xy', 'hs', 'rgb'].includes(m)
      ) ?? false,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function turnOn(entityId: string, brightness?: number) {
  const data: { entity_id: string; brightness?: number } = { entity_id: entityId };
  if (brightness !== undefined) {
    data.brightness = Math.round((brightness / 100) * 255);
  }
  return haFetch('/api/services/light/turn_on', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function turnOff(entityId: string) {
  return haFetch('/api/services/light/turn_off', {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
}

export async function toggle(entityId: string) {
  return haFetch('/api/services/light/toggle', {
    method: 'POST',
    body: JSON.stringify({ entity_id: entityId }),
  });
}

export async function setBrightness(entityId: string, brightness: number) {
  return turnOn(entityId, brightness);
}

export async function turnOffAll() {
  const lights = await getLights();
  const onLights = lights.filter(l => l.state === 'on');
  await Promise.all(onLights.map(l => turnOff(l.entity_id)));
}

// Scene/automation helpers
export async function callService(domain: string, service: string, data: Record<string, unknown> = {}) {
  return haFetch(`/api/services/${domain}/${service}`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function saveConfig(url: string, token: string) {
  localStorage.setItem('ha_url', url);
  localStorage.setItem('ha_token', token);
}

export function getConfig() {
  return {
    url: localStorage.getItem('ha_url') || HA_URL,
    token: localStorage.getItem('ha_token') || HA_TOKEN,
  };
}
