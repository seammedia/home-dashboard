'use client';

import { useState, useEffect } from 'react';
import { 
  Home, Lightbulb, Flower2, DoorOpen, Wind, Camera, Blinds,
  Moon, Sun, Power, Thermometer, Droplets, CloudSun
} from 'lucide-react';

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

// Room definitions
const ROOMS = [
  { id: 'living', name: 'Living Room', icon: '🛋️', temp: '21.0°C', humidity: '49%', color: 'room-card-living' },
  { id: 'bedroom', name: 'Bedroom', icon: '🛏️', temp: '19.5°C', humidity: '52%', color: 'room-card-bedroom' },
  { id: 'kitchen', name: 'Kitchen', icon: '🍳', temp: '20.2°C', humidity: '45%', color: 'room-card-guest' },
  { id: 'office', name: 'Office', icon: '💻', temp: '21.5°C', humidity: '48%', color: 'room-card-baby' },
];

// Light definitions
const LIGHTS = [
  { id: 'living-main', name: 'Living Room', brightness: 80, on: true },
  { id: 'kitchen', name: 'Kitchen', brightness: 100, on: true },
  { id: 'bedroom', name: 'Bedroom', brightness: 30, on: true },
  { id: 'office', name: 'Office', brightness: 0, on: false },
];

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('home');
  const [greeting, setGreeting] = useState('');
  const [currentTime, setCurrentTime] = useState('');
  const [currentDate, setCurrentDate] = useState('');
  const [lights, setLights] = useState(LIGHTS);

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
        weekday: 'short',
        day: 'numeric',
        month: 'short'
      }));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const toggleLight = (id: string) => {
    setLights(lights.map(light => 
      light.id === id ? { ...light, on: !light.on, brightness: light.on ? 0 : 80 } : light
    ));
  };

  const handleGoodNight = () => {
    // Turn off all lights
    setLights(lights.map(light => ({ ...light, on: false, brightness: 0 })));
    // TODO: Call Home Assistant API to turn off TV, etc.
    alert('Good Night! Turning off all lights and devices...');
  };

  return (
    <div className="min-h-screen bg-gradient-mesh flex flex-col">
      {/* Main Content */}
      <main className="flex-1 p-4 pb-24 overflow-y-auto">
        {activeTab === 'home' && (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-2xl font-bold text-white">{greeting}</h1>
                <p className="text-gray-400 text-sm">{currentDate}</p>
              </div>
              <div className="text-right">
                <p className="text-3xl font-light text-white">{currentTime}</p>
              </div>
            </div>

            {/* Good Night Button */}
            <button 
              onClick={handleGoodNight}
              className="w-full good-night-btn text-white py-6 rounded-2xl flex items-center justify-center gap-3 text-lg font-semibold"
            >
              <Moon className="w-6 h-6" />
              Good Night
            </button>

            {/* Climate Card */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-gray-400 uppercase tracking-wider">Climate</span>
                <CloudSun className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Thermometer className="w-5 h-5 text-orange-400" />
                  <div>
                    <p className="text-2xl font-semibold text-white">21.5°C</p>
                    <p className="text-xs text-gray-500">Indoor</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Sun className="w-5 h-5 text-yellow-400" />
                  <div>
                    <p className="text-2xl font-semibold text-white">18°C</p>
                    <p className="text-xs text-gray-500">Outdoor</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Droplets className="w-5 h-5 text-blue-400" />
                  <div>
                    <p className="text-2xl font-semibold text-white">52%</p>
                    <p className="text-xs text-gray-500">Humidity</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Rooms Grid */}
            <div>
              <h2 className="text-sm text-gray-400 uppercase tracking-wider mb-3">Rooms</h2>
              <div className="grid grid-cols-2 gap-3">
                {ROOMS.map((room) => (
                  <div 
                    key={room.id}
                    className={`${room.color} p-4 rounded-2xl cursor-pointer hover:scale-[1.02] transition-transform`}
                  >
                    <div className="text-2xl mb-2">{room.icon}</div>
                    <p className="font-semibold text-white text-sm">{room.name}</p>
                    <p className="text-xs text-white/70">{room.temp} / {room.humidity}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Quick Lights */}
            <div className="glass-card p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-400 uppercase tracking-wider">Lights</span>
                <Lightbulb className="w-5 h-5 text-yellow-400" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {lights.map((light) => (
                  <button
                    key={light.id}
                    onClick={() => toggleLight(light.id)}
                    className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                      light.on 
                        ? 'bg-yellow-500/20 border border-yellow-500/30' 
                        : 'bg-white/5 border border-white/10'
                    }`}
                  >
                    <div className={`w-3 h-3 rounded-full ${light.on ? 'bg-yellow-400' : 'bg-gray-600'}`} />
                    <span className="text-sm text-white">{light.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'lights' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-white">Lights</h1>
            <div className="space-y-3">
              {lights.map((light) => (
                <div key={light.id} className="glass-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Lightbulb className={`w-5 h-5 ${light.on ? 'text-yellow-400' : 'text-gray-600'}`} />
                      <span className="text-white font-medium">{light.name}</span>
                    </div>
                    <button 
                      onClick={() => toggleLight(light.id)}
                      className={`w-12 h-6 rounded-full transition-colors ${
                        light.on ? 'bg-yellow-500' : 'bg-gray-700'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full bg-white shadow-md transform transition-transform ${
                        light.on ? 'translate-x-6' : 'translate-x-0.5'
                      }`} />
                    </button>
                  </div>
                  {light.on && (
                    <input 
                      type="range" 
                      min="1" 
                      max="100" 
                      value={light.brightness}
                      onChange={(e) => {
                        setLights(lights.map(l => 
                          l.id === light.id ? { ...l, brightness: parseInt(e.target.value) } : l
                        ));
                      }}
                      className="w-full light-slider"
                    />
                  )}
                </div>
              ))}
            </div>
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
            <div className="glass-card p-8 text-center">
              <Camera className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">No cameras configured yet</p>
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
