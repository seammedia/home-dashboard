'use client';

import { useState, useEffect, useCallback } from 'react';
import * as ha from './homeassistant';
import type { Light } from './homeassistant';

export function useHomeAssistant() {
  const [lights, setLights] = useState<Light[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const lightsData = await ha.getLights();
      setLights(lightsData);
      setConnected(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    // Poll every 5 seconds for updates
    const interval = setInterval(refresh, 5000);
    return () => clearInterval(interval);
  }, [refresh]);

  const toggleLight = useCallback(async (entityId: string) => {
    const light = lights.find(l => l.entity_id === entityId);
    if (!light) return;

    // Optimistic update
    setLights(prev => prev.map(l => 
      l.entity_id === entityId 
        ? { ...l, state: l.state === 'on' ? 'off' : 'on' } as Light
        : l
    ));

    try {
      if (light.state === 'on') {
        await ha.turnOff(entityId);
      } else {
        await ha.turnOn(entityId);
      }
    } catch {
      // Revert on error
      refresh();
    }
  }, [lights, refresh]);

  const setBrightness = useCallback(async (entityId: string, brightness: number) => {
    // Optimistic update
    setLights(prev => prev.map(l => 
      l.entity_id === entityId 
        ? { ...l, brightness, state: brightness > 0 ? 'on' : 'off' } as Light
        : l
    ));

    try {
      if (brightness === 0) {
        await ha.turnOff(entityId);
      } else {
        await ha.setBrightness(entityId, brightness);
      }
    } catch {
      refresh();
    }
  }, [refresh]);

  const turnOffAll = useCallback(async () => {
    // Optimistic update
    setLights(prev => prev.map(l => ({ ...l, state: 'off', brightness: 0 } as Light)));
    
    try {
      await ha.turnOffAll();
    } catch {
      refresh();
    }
  }, [refresh]);

  return {
    lights,
    loading,
    connected,
    error,
    refresh,
    toggleLight,
    setBrightness,
    turnOffAll,
  };
}
