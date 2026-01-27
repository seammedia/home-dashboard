# Home Dashboard

A Next.js dashboard for controlling Home Assistant smart home devices, deployed on Vercel.

## Features

- Control Philips Hue lights (on/off, brightness)
- Room-based organization with bento grid layout
- "Good Night" button to turn off all lights
- Real-time status updates
- Mobile-friendly responsive design

## Architecture

```
[Vercel Dashboard] <--HTTPS--> [Cloudflare Tunnel] <---> [Home Assistant]
                                                              |
                                                        [Docker/OrbStack]
                                                              |
                                            [Hue Bridge Proxy] --> [Philips Hue Bridge]
```

## Setup Requirements

### Home Assistant (Docker on macOS with OrbStack)

Home Assistant runs in Docker via OrbStack. Due to OrbStack's network isolation, containers cannot directly reach LAN devices. A proxy solution is required.

**Container command:**
```bash
docker run -d \
  --name homeassistant \
  --network host \
  --restart unless-stopped \
  -e TZ=Australia/Melbourne \
  -v /Users/clawd/homeassistant/config:/config \
  homeassistant/home-assistant:stable
```

### Hue Bridge Proxy (Required for OrbStack)

OrbStack Docker containers can only reach the Mac host (10.0.0.15), not other LAN devices. A `socat` proxy forwards traffic to the Hue Bridge.

**Install socat:**
```bash
brew install socat
```

**Start proxies:**
```bash
socat TCP-LISTEN:443,reuseaddr,fork TCP:10.0.0.2:443 &
socat TCP-LISTEN:80,reuseaddr,fork TCP:10.0.0.2:80 &
```

**Update Home Assistant Hue config** (`~/.storage/core.config_entries`):
Change the Hue Bridge host from the actual IP (e.g., `10.0.0.2`) to the Mac's IP (`10.0.0.15`).

**LaunchAgent for persistence** (`~/Library/LaunchAgents/com.huebridge.proxy.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.huebridge.proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/bin/bash</string>
        <string>-c</string>
        <string>/opt/homebrew/bin/socat TCP-LISTEN:443,reuseaddr,fork TCP:10.0.0.2:443 &amp; /opt/homebrew/bin/socat TCP-LISTEN:80,reuseaddr,fork TCP:10.0.0.2:80 &amp; wait</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

### Cloudflare Tunnel (Remote Access)

Cloudflare Tunnel provides secure remote access to Home Assistant without opening firewall ports.

**Install:**
```bash
brew install cloudflared
```

**Quick tunnel (URL changes on restart):**
```bash
cloudflared tunnel --url http://localhost:8123
```

**LaunchAgent for persistence** (`~/Library/LaunchAgents/com.cloudflare.tunnel.homeassistant.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflare.tunnel.homeassistant</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>--url</string>
        <string>http://localhost:8123</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/clawd/clawd/logs/cloudflared-ha.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/clawd/clawd/logs/cloudflared-ha-error.log</string>
</dict>
</plist>
```

**Get current tunnel URL:**
```bash
cat ~/clawd/logs/cloudflared-ha-error.log | grep trycloudflare.com | tail -1
```

**Note:** Free tunnels get a random URL that changes on restart. For a permanent URL, use a Cloudflare account with a custom domain.

### Home Assistant Configuration

**`configuration.yaml`:**
```yaml
# Loads default set of integrations
default_config:

# Allow dashboard to connect via Cloudflare Tunnel
http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - ::1
    - 172.16.0.0/12
    - 10.0.0.0/8
    - 192.168.0.0/16
  cors_allowed_origins:
    - "https://home-dashboard-nine.vercel.app"
    - "http://localhost:3000"
    - "https://YOUR-TUNNEL-URL.trycloudflare.com"

frontend:
  themes: !include_dir_merge_named themes

automation: !include automations.yaml
script: !include scripts.yaml
scene: !include scenes.yaml
```

### Vercel Environment Variables

Set these in Vercel dashboard or via CLI:

```bash
vercel env add NEXT_PUBLIC_HA_URL production
# Enter: https://YOUR-TUNNEL-URL.trycloudflare.com

vercel env add NEXT_PUBLIC_HA_TOKEN production
# Enter: your Home Assistant long-lived access token
```

**Generate a long-lived access token:**
1. In Home Assistant, click your profile (bottom left)
2. Scroll to "Long-Lived Access Tokens"
3. Click "Create Token"
4. Copy the token (it won't be shown again)

## API Notes

### Service Domains

The dashboard uses `homeassistant.*` services instead of `light.*` services:
- `homeassistant/turn_on` - Works for all entity types
- `homeassistant/turn_off` - Works for all entity types
- `homeassistant/toggle` - Works for all entity types

This is more universal and works even when the `light` domain services aren't available.

## Known Limitations

### OrbStack Docker Networking
- Containers cannot directly reach LAN devices
- Only the Mac host IP (10.0.0.15) is reachable from containers
- Workaround: Use `socat` proxies on the Mac to forward traffic

### Reolink Battery Cameras (Argus 3 Pro, etc.)
- Battery-powered Reolink cameras are **cloud-only**
- They do NOT support RTSP, RTMP, HTTP, HTTPS, or ONVIF protocols
- Cannot be integrated with Home Assistant locally
- Alternative: Use wired Reolink PoE cameras which have local APIs

### Apple TV Integration
- Requires proper network access from Home Assistant container
- With OrbStack, would need proxy setup similar to Hue Bridge
- The integration can only control media playback, NOT power off the TV hardware
- Apple TV sleep mode uses ~0.5W, so powering off isn't necessary

### Smart Plugs and TVs
- Not recommended to hard-cut power to Apple TV/smart TVs regularly
- Can interrupt updates and cause minor flash storage wear
- Better to use sleep commands or let devices sleep naturally

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```

## Troubleshooting

### "Disconnected" in Dashboard
1. Check Cloudflare tunnel is running: `pgrep cloudflared`
2. Check tunnel URL hasn't changed: `cat ~/clawd/logs/cloudflared-ha-error.log | grep trycloudflare.com | tail -1`
3. Update Vercel env vars if URL changed, then redeploy

### Lights Show "Unavailable"
1. Check Hue Bridge proxy is running: `lsof -i :443 | grep socat`
2. Restart proxies if needed
3. Check Home Assistant Hue integration is configured to use Mac IP (10.0.0.15)

### Safari vs Chrome Issues
- Safari may have stricter CORS handling
- Ensure the tunnel URL is in Home Assistant's `cors_allowed_origins`
- Try clearing site data and re-entering credentials

### Token Format
- Long-lived access tokens must be entered as one continuous string
- No spaces or line breaks
- Format: `eyJhbG...` (183 characters, 3 parts separated by dots)

## File Structure

```
home-dashboard/
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx          # Main dashboard component
│   └── lib/
│       ├── homeassistant.ts  # HA API integration
│       └── useHomeAssistant.ts # React hook for HA
├── public/
├── .env.local                # Local environment variables
└── README.md
```

## Related Services

| Service | Location | Purpose |
|---------|----------|---------|
| Home Assistant | Docker (OrbStack) | Smart home hub |
| Hue Bridge | 10.0.0.2 (via proxy) | Philips Hue lights |
| Cloudflare Tunnel | Mac | Remote HTTPS access |
| Vercel | Cloud | Dashboard hosting |

## Useful Commands

```bash
# Check all services
docker ps                                    # Home Assistant container
pgrep cloudflared                           # Cloudflare tunnel
lsof -i :80 -i :443 | grep socat           # Hue Bridge proxies

# Restart Home Assistant
docker restart homeassistant

# View Home Assistant logs
docker logs homeassistant --tail 50

# Test Home Assistant API
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/

# Redeploy to Vercel
vercel --prod
```
