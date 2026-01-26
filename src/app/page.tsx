'use client';

import { useState, useEffect } from 'react';
import { 
  Home, Lightbulb, Flower2, DoorOpen, Wind, Camera, Blinds,
  Moon, Thermometer, Droplets, Sofa, Bed, Baby, Gamepad2, UtensilsCrossed,
  ChevronRight, ChevronLeft, Settings, Wifi, WifiOff, Loader2, Monitor
} from 'lucide-react';
import { useHomeAssistant } from '@/lib/useHomeAssistant';
import { saveConfig, getConfig, testConnection } from '@/lib/homeassistant';

// Tab definitions
const TABS = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'lights', label: 'Lights', icon: Lightbulb },
  { id: 'garden', label: 'Garden', icon: Flower2 },
  { id: 'doors', label: 'Doors', icon: DoorOpen },
  { id: 'air', label: 'Air', icon: Wind },
  { id: 'cameras', label: 'Cameras', icon: Camera },
  { id: 'blinds', label: 'Blinds', icon: Blinds },
];

// Room definitions with light entity patterns
const ROOMS = [
  { 
    id: 'office', 
    name: 'Office', 
    icon: Monitor, 
    temp: '21.5°C', 
    humidity: '45%', 
    color: 'from-purple-500 to-indigo-600',
    lightPatterns: ['office', 'upstairs_office']
  },
  { 
    id: 'living', 
    name: 'Living Room', 
    icon: Sofa, 
    temp: '21.0°C', 
    humidity: '49%', 
    color: 'from-yellow-500 to-amber-600',
    lightPatterns: ['living', 'tv_unit']
  },
  { 
    id: 'master', 
    name: 'Master Bedroom', 
    icon: Bed, 
    temp: '19.5°C', 
    humidity: '52%', 
    color: 'from-green-500 to-emerald-600',
    lightPatterns: ['master_bedroom']
  },
  { 
    id: 'bedroom', 
    name: 'Bedroom', 
    icon: Bed, 
    temp: '20.0°C', 
    humidity: '50%', 
    color: 'from-blue-500 to-cyan-600',
    lightPatterns: ['bedroom_light']
  },
  { 
    id: 'ziggy', 
    name: "Ziggy's Room", 
    icon: Baby, 
    temp: '20.0°C', 
    humidity: '55%', 
    color: 'from-lime-400 to-green-500',
    lightPatterns: ['ziggy']
  },
  { 
    id: 'nirvana', 
    name: "Nirvana's Room", 
    icon: Baby, 
    temp: '20.2°C', 
    humidity: '50%', 
    color: 'from-teal-400 to-cyan-500',
    lightPatterns: ['nirvana']
  },
  { 
    id: 'playroom', 
    name: 'Playroom', 
    icon: Gamepad2, 
    temp: '21.5°C', 
    humidity: '48%', 
    color: 'from-cyan-400 to-teal-500',
    lightPatterns: ['playroom']
  },
  { 
    id: 'kitchen', 
    name: 'Kitchen', 
    icon: UtensilsCrossed, 
    temp: '22.0°C', 
    humidity: '45%', 
    color: 'from-orange-500 to-red-600',
    lightPatterns: ['kitchen']
  },
  { 
    id: 'other', 
    name: 'Other', 
    icon: Lightbulb, 
    temp: '-', 
    humidity: '-', 
    color: 'from-gray-500 to-gray-600',
    lightPatterns: ['stairs', 'hue_go', 'bar']
  },
];

// Calendar events (placeholder)
const CALENDAR_EVENTS = [
  { day: 'Mon', date: '27', title: 'School Drop-off', time: '8:30 AM', color: 'bg-blue-500' },
  { day: 'Tue', date: '28', title: 'Dentist', time: '2:00 PM', color: 'bg-pink-500' },
  { day: 'Wed', date: '29', title: 'Swimming Lessons', time: '4:00 PM', color: 'bg-green-500' },
  { day: 'Thu', date: '30', title: 'Work Meeting', time: '10:00 AM', color: 'bg-purple-500' },
];

// Camera feeds (placeholder)
const CAMERAS = [
  { id: 'driveway', name: 'Driveway' },
  { id: 'backyard', name: 'Backyard' },
  { id: 'front', name: 'Front Door' },
  { id: 'garage', name: 'Garage' },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null);
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [haUrl, setHaUrl] = useState('');
  const [haToken, setHaToken] = useState('');
  const [configStatus, setConfigStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  // Home Assistant integration
  const { 
    lights, 
    loading: lightsLoading, 
    connected: haConnected, 
    error: haError,
    toggleLight, 
    setBrightness, 
    turnOffAll,
    refresh: refreshLights
  } = useHomeAssistant();

  // Load saved config on mount
  useEffect(() => {
    const config = getConfig();
    setHaUrl(config.url);
    setHaToken(config.token);
  }, []);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hour = now.getHours();
      
      if (hour < 12) setGreeting('Good Morning!');
      else if (hour < 17) setGreeting('Good Afternoon!');
      else setGreeting('Good Evening!');
      
      setCurrentTime(now.toLocaleTimeString('en-AU', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      }));
      
      setCurrentDate(now.toLocaleDateString('en-AU', { 
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleGoodNight = async () => {
    await turnOffAll();
  };

  const handleSaveConfig = async () => {
    setConfigStatus('testing');
    saveConfig(haUrl, haToken);
    
    const success = await testConnection();
    if (success) {
      setConfigStatus('success');
      refreshLights();
      setTimeout(() => {
        setShowSettings(false);
        setConfigStatus('idle');
      }, 1500);
    } else {
      setConfigStatus('error');
    }
  };

  // Get lights for a specific room
  const getLightsForRoom = (roomId: string) => {
    const room = ROOMS.find(r => r.id === roomId);
    if (!room) return [];
    
    return lights.filter(light => 
      room.lightPatterns.some(pattern => 
        light.entity_id.toLowerCase().includes(pattern.toLowerCase())
      )
    );
  };

  // Count lights that are on for a room
  const getRoomLightsOnCount = (roomId: string) => {
    return getLightsForRoom(roomId).filter(l => l.state === 'on').length;
  };

  // Turn off all lights in a room
  const turnOffRoomLights = async (roomId: string) => {
    const roomLights = getLightsForRoom(roomId);
    for (const light of roomLights.filter(l => l.state === 'on')) {
      await toggleLight(light.entity_id);
    }
  };

  // Count total lights that are on
  const lightsOnCount = lights.filter(l => l.state === 'on').length;

  // Get current room data
  const currentRoom = selectedRoom ? ROOMS.find(r => r.id === selectedRoom) : null;
  const currentRoomLights = selectedRoom ? getLightsForRoom(selectedRoom) : [];

  return (
    <div className="min-h-screen bg-gradient-mesh flex flex-col">
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="glass-card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Home Assistant Settings</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">URL</label>
                <input
                  type="text"
                  value={haUrl}
                  onChange={(e) => setHaUrl(e.target.value)}
                  placeholder="http://192.168.1.x:8123"
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Long-Lived Access Token</label>
                <input
                  type="password"
                  value={haToken}
                  onChange={(e) => setHaToken(e.target.value)}
                  placeholder="eyJ..."
                  className="w-full bg-white/10 border border-white/20 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
                />
              </div>
              
              <div className="flex gap-3">
                <button
                  onClick={() => setShowSettings(false)}
                  className="flex-1 bg-white/10 hover:bg-white/20 text-white py-3 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveConfig}
                  disabled={configStatus === 'testing'}
                  className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                    configStatus === 'success' ? 'bg-green-600' :
                    configStatus === 'error' ? 'bg-red-600' :
                    'bg-cyan-600 hover:bg-cyan-700'
                  } text-white`}
                >
                  {configStatus === 'testing' && <Loader2 className="w-4 h-4 animate-spin" />}
                  {configStatus === 'success' ? 'Connected!' :
                   configStatus === 'error' ? 'Failed' :
                   configStatus === 'testing' ? 'Testing...' : 'Save & Test'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Room Detail View */}
      {selectedRoom && currentRoom && (
        <div className="fixed inset-0 bg-gradient-mesh z-40 flex flex-col">
          {/* Room Header */}
          <div className={`bg-gradient-to-r ${currentRoom.color} p-6`}>
            <button 
              onClick={() => setSelectedRoom(null)}
              className="flex items-center gap-2 text-white/80 hover:text-white mb-4"
            >
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <currentRoom.icon className="w-10 h-10 text-white" />
                <div>
                  <h1 className="text-2xl font-bold text-white">{currentRoom.name}</h1>
                  <p className="text-white/70">{currentRoomLights.length} lights</p>
                </div>
              </div>
              <button
                onClick={() => turnOffRoomLights(selectedRoom)}
                className="bg-black/20 hover:bg-black/30 text-white px-4 py-2 rounded-lg transition-colors"
              >
                All Off
              </button>
            </div>
          </div>

          {/* Room Content */}
          <div className="flex-1 p-4 overflow-y-auto pb-24">
            <div className="grid grid-cols-2 gap-4 mb-6">
              {/* Temperature Card */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Thermometer className="w-5 h-5 text-orange-400" />
                  <span className="text-gray-400 text-sm">Temperature</span>
                </div>
                <p className="text-3xl font-bold text-white">{currentRoom.temp}</p>
              </div>

              {/* Humidity Card */}
              <div className="glass-card p-4">
                <div className="flex items-center gap-3 mb-2">
                  <Droplets className="w-5 h-5 text-cyan-400" />
                  <span className="text-gray-400 text-sm">Humidity</span>
                </div>
                <p className="text-3xl font-bold text-white">{currentRoom.humidity}</p>
              </div>
            </div>

            {/* Lights Section */}
            <div>
              <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Lights</h2>
              {currentRoomLights.length === 0 ? (
                <div className="glass-card p-8 text-center">
                  <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400">No lights in this room</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentRoomLights.map((light) => (
                    <div key={light.entity_id} className="glass-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Lightbulb className={`w-5 h-5 ${light.state === 'on' ? 'text-yellow-400' : 'text-gray-600'}`} />
                          <span className="text-white font-medium">{light.name}</span>
                        </div>
                        <button 
                          onClick={() => toggleLight(light.entity_id)}
                          className={`w-12 h-6 rounded-full transition-colors ${
                            light.state === 'on' ? 'bg-yellow-500' : 'bg-gray-700'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                            light.state === 'on' ? 'translate-x-6' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </div>
                      {light.state === 'on' && light.supports_brightness && (
                        <div className="flex items-center gap-3">
                          <input 
                            type="range" 
                            min="1" 
                            max="100" 
                            value={light.brightness}
                            onChange={(e) => setBrightness(light.entity_id, parseInt(e.target.value))}
                            className="flex-1 light-slider"
                          />
                          <span className="text-xs text-gray-400 w-8 text-right">{light.brightness}%</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Bottom Nav (same as main) */}
          <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 px-2 py-2 safe-area-pb">
            <div className="flex justify-around items-center max-w-lg mx-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setSelectedRoom(null);
                      setActiveTab(tab.id);
                    }}
                    className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
                      isActive ? 'tab-active' : 'text-gray-500 hover:text-gray-300'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Top Row: Greeting/Climate + Calendar */}
            <div className="grid grid-cols-3 gap-4">
              {/* Left: Greeting + Climate (2 cols) */}
              <div className="col-span-2 space-y-4">
                {/* Header with time */}
                <div className="glass-card p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h1 className="text-2xl font-bold text-white">{greeting}</h1>
                      <p className="text-gray-400 text-sm">{currentDate}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <button 
                        onClick={() => setShowSettings(true)}
                        className="text-gray-500 hover:text-white transition-colors"
                      >
                        <Settings className="w-5 h-5" />
                      </button>
                      <div className="text-right">
                        <p className="text-3xl font-light text-white">{currentTime}</p>
                        <div className="flex items-center gap-1 justify-end">
                          {haConnected ? (
                            <Wifi className="w-3 h-3 text-green-400" />
                          ) : (
                            <WifiOff className="w-3 h-3 text-red-400" />
                          )}
                          <span className="text-xs text-gray-500">
                            {haConnected ? 'Connected' : 'Disconnected'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Climate Row */}
                  <div className="flex items-center gap-6 mt-4 pt-4 border-t border-white/10">
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-orange-400" />
                      <div>
                        <p className="text-xl font-semibold text-white">21.5°C</p>
                        <p className="text-xs text-gray-500">Indoor</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Thermometer className="w-5 h-5 text-blue-400" />
                      <div>
                        <p className="text-xl font-semibold text-white">18°C</p>
                        <p className="text-xs text-gray-500">Outdoor</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Lightbulb className="w-5 h-5 text-yellow-400" />
                      <div>
                        <p className="text-xl font-semibold text-white">{lightsOnCount}</p>
                        <p className="text-xs text-gray-500">Lights On</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Good Night Button */}
                <button 
                  onClick={handleGoodNight}
                  disabled={!haConnected}
                  className="w-full good-night-btn text-white py-5 rounded-2xl flex items-center justify-center gap-3 text-lg font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Moon className="w-6 h-6" />
                  Good Night
                </button>
              </div>

              {/* Right: Calendar (1 col) */}
              <div className="glass-card p-4">
                <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Calendar</h2>
                <div className="space-y-2">
                  {CALENDAR_EVENTS.map((event, idx) => (
                    <div key={idx} className="flex items-center gap-3">
                      <div className="text-center w-10">
                        <p className="text-xs text-gray-500">{event.day}</p>
                        <p className="text-lg font-bold text-white">{event.date}</p>
                      </div>
                      <div className={`w-1 h-10 rounded-full ${event.color}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white font-medium truncate">{event.title}</p>
                        <p className="text-xs text-gray-500">{event.time}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Rooms Row */}
            <div>
              <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Rooms</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4">
                {ROOMS.filter(r => r.id !== 'other').map((room) => {
                  const Icon = room.icon;
                  const lightsOn = getRoomLightsOnCount(room.id);
                  const totalLights = getLightsForRoom(room.id).length;
                  return (
                    <div 
                      key={room.id}
                      onClick={() => setSelectedRoom(room.id)}
                      className={`flex-shrink-0 w-28 h-28 bg-gradient-to-br ${room.color} p-3 rounded-2xl cursor-pointer hover:scale-[1.02] transition-transform flex flex-col justify-between`}
                    >
                      <div className="flex justify-between items-start">
                        <Icon className="w-6 h-6 text-white/90" />
                        {lightsOn > 0 && (
                          <div className="bg-yellow-400 text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {lightsOn}
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-white text-xs leading-tight">{room.name}</p>
                        <p className="text-[10px] text-white/70">
                          {totalLights > 0 ? `${totalLights} lights` : room.temp}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cameras Row */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm text-gray-400 uppercase tracking-wider">Cameras</h2>
                <button className="text-xs text-cyan-400 flex items-center gap-1">
                  View All <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="grid grid-cols-4 gap-3">
                {CAMERAS.map((camera) => (
                  <div key={camera.id} className="glass-card aspect-video rounded-xl overflow-hidden relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                      <Camera className="w-8 h-8 text-gray-600" />
                    </div>
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1">
                      <p className="text-[10px] text-white truncate">{camera.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Bento: Media + Quick Actions */}
            <div className="grid grid-cols-2 gap-4">
              {/* Media Player Placeholder */}
              <div className="glass-card p-4">
                <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Media</h2>
                <div className="aspect-video bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl flex items-center justify-center">
                  <p className="text-gray-600 text-sm">No media playing</p>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="glass-card p-4">
                <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Quick Actions</h2>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={handleGoodNight}
                    disabled={!haConnected}
                    className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition-colors disabled:opacity-50"
                  >
                    <p className="text-xs text-gray-400">All Lights Off</p>
                  </button>
                  <button className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition-colors">
                    <p className="text-xs text-gray-400">Movie Mode</p>
                  </button>
                  <button className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition-colors">
                    <p className="text-xs text-gray-400">Away Mode</p>
                  </button>
                  <button className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3 text-center transition-colors">
                    <p className="text-xs text-gray-400">Party Mode</p>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lights' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-white">Lights</h1>
              {haConnected ? (
                <span className="text-xs text-green-400 flex items-center gap-1">
                  <Wifi className="w-3 h-3" /> Live
                </span>
              ) : (
                <button 
                  onClick={() => setShowSettings(true)}
                  className="text-xs text-red-400 flex items-center gap-1"
                >
                  <WifiOff className="w-3 h-3" /> Connect
                </button>
              )}
            </div>

            {lightsLoading ? (
              <div className="glass-card p-8 text-center">
                <Loader2 className="w-8 h-8 text-cyan-400 mx-auto animate-spin mb-3" />
                <p className="text-gray-400">Loading lights...</p>
              </div>
            ) : !haConnected ? (
              <div className="glass-card p-8 text-center">
                <WifiOff className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400 mb-4">Not connected to Home Assistant</p>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-2 rounded-lg transition-colors"
                >
                  Configure
                </button>
              </div>
            ) : lights.length === 0 ? (
              <div className="glass-card p-8 text-center">
                <Lightbulb className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">No lights found</p>
              </div>
            ) : (
              <div className="space-y-3">
                {lights.map((light) => (
                  <div key={light.entity_id} className="glass-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <Lightbulb className={`w-5 h-5 ${light.state === 'on' ? 'text-yellow-400' : 'text-gray-600'}`} />
                        <span className="text-white font-medium">{light.name}</span>
                      </div>
                      <button 
                        onClick={() => toggleLight(light.entity_id)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          light.state === 'on' ? 'bg-yellow-500' : 'bg-gray-700'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                          light.state === 'on' ? 'translate-x-6' : 'translate-x-0.5'
                        }`} />
                      </button>
                    </div>
                    {light.state === 'on' && light.supports_brightness && (
                      <div className="flex items-center gap-3">
                        <input 
                          type="range" 
                          min="1" 
                          max="100" 
                          value={light.brightness}
                          onChange={(e) => setBrightness(light.entity_id, parseInt(e.target.value))}
                          className="flex-1 light-slider"
                        />
                        <span className="text-xs text-gray-400 w-8 text-right">{light.brightness}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'garden' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Garden</h1>
            <div className="glass-card p-4">
              <p className="text-gray-400 mb-4">Watering controls are available in the dedicated app:</p>
              <a 
                href="https://watering-app.vercel.app" 
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-600 hover:bg-green-700 text-white py-4 rounded-xl text-center font-semibold transition-colors"
              >
                <Flower2 className="w-5 h-5 inline-block mr-2" />
                Open Watering App
              </a>
            </div>
          </div>
        )}

        {activeTab === 'doors' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Doors</h1>
            <div className="glass-card p-8 text-center">
              <DoorOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No door sensors configured yet</p>
            </div>
          </div>
        )}

        {activeTab === 'air' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Air Quality</h1>
            <div className="glass-card p-8 text-center">
              <Wind className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No air monitors configured yet</p>
            </div>
          </div>
        )}

        {activeTab === 'cameras' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Cameras</h1>
            <div className="grid grid-cols-2 gap-4">
              {CAMERAS.map((camera) => (
                <div key={camera.id} className="glass-card aspect-video rounded-xl overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                    <Camera className="w-12 h-12 text-gray-600" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-3 py-2">
                    <p className="text-sm text-white">{camera.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'blinds' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Blinds</h1>
            <div className="glass-card p-8 text-center">
              <Blinds className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No smart blinds configured yet</p>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Tab Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-xl border-t border-white/10 px-2 py-2 safe-area-pb">
        <div className="flex justify-around items-center max-w-lg mx-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center py-2 px-3 rounded-xl transition-all ${
                  isActive ? 'tab-active' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] mt-1 font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
