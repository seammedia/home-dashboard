# Home Dashboard

A Next.js dashboard for controlling Home Assistant smart home devices, deployed on Vercel.

## Features

- Control Philips Hue lights (on/off, brightness)
- Room-based organization with bento grid layout
- "Good Night" button to turn off all lights
- Google Calendar integration (via iCal)
- Real-time status updates
- Mobile-friendly responsive design
- PIN-protected access (saved to browser localStorage)
- Live camera feeds with snapshot polling (no storage cost)
- Fullscreen camera view with pan/tilt controls

## Security - MUST FIX BEFORE ADDING MORE CAMERAS

The current setup has several security issues that need to be resolved before installing cameras in sensitive areas (kids' rooms, bedrooms, etc.).

### Current Vulnerabilities

#### 1. HA Token Exposed to Browser (CRITICAL)
- The env vars use `NEXT_PUBLIC_` prefix, which bundles the HA token into the client-side JavaScript
- Anyone visiting the dashboard can open DevTools and extract the token
- That token gives full access to Home Assistant - cameras, lights, PTZ controls, everything
- The token expires in 2085 (effectively permanent)

#### 2. API Routes Have No Authentication (CRITICAL)
- `/api/camera/garage` returns a live camera snapshot to anyone who hits the URL
- `/api/camera/garage/ptz` lets anyone pan/tilt the camera with a POST request
- No session check, no auth header validation, no middleware - completely open
- Example: `curl https://home-dashboard-nine.vercel.app/api/camera/garage` returns a JPEG, no questions asked

#### 3. PIN Protection is Client-Side Only (HIGH)
- The PIN (`11017261`) is hardcoded in `page.tsx` and shipped to the browser in the JS bundle
- Anyone can read it from view-source or the compiled JS
- Even without the PIN, the API routes are unprotected, so the PIN is just a visual gate
- Can be bypassed by running `localStorage.setItem('home-dashboard-authenticated', 'true')` in browser console

### Required Fixes (Do All Before Adding Cameras)

#### Fix 1: Move HA Token Server-Side
- Rename `NEXT_PUBLIC_HA_TOKEN` to `HA_TOKEN` (remove `NEXT_PUBLIC_` prefix)
- Rename `NEXT_PUBLIC_HA_URL` to `HA_URL`
- This keeps the token on the server only - never sent to the browser
- Update all API routes to use `process.env.HA_TOKEN` instead of `process.env.NEXT_PUBLIC_HA_TOKEN`
- Update the `useHomeAssistant` hook to call local API routes instead of HA directly
- Update Vercel env vars to use the new names (without `NEXT_PUBLIC_`)

#### Fix 2: Add Server-Side Authentication to API Routes
- Create a middleware or auth check that runs before every API route
- Options (pick one):
  - **Session cookie**: PIN verification sets an httpOnly cookie, API routes check for it
  - **NextAuth.js**: Full auth library with session management
  - **Simple API key**: Generate a random session token on PIN success, validate on each request
- At minimum: verify a session token in every API route before returning data

#### Fix 3: Move PIN Verification Server-Side
- Create a `/api/auth` endpoint that validates the PIN and sets a secure httpOnly cookie
- The PIN should NOT be in the client-side JS bundle - keep it in an env var (`DASHBOARD_PIN`)
- The cookie should have `httpOnly`, `secure`, and `sameSite: strict` flags
- Add session expiry (e.g., 24 hours) so it's not permanent

#### Fix 4: Rotate the HA Token
- The current token should be considered compromised (it's been in browser bundles on Vercel CDN)
- In Home Assistant: Profile - Long-Lived Access Tokens - delete the current token
- Create a new token
- Update `.env.local` and Vercel env vars with the new token
- Do this AFTER fixing the `NEXT_PUBLIC_` prefix issue (Fix 1), otherwise the new token gets exposed too

#### Fix 5: Add Rate Limiting (Optional but Recommended)
- Prevent brute-force PIN attempts
- Prevent rapid-fire camera snapshot scraping
- Vercel has edge middleware that can do basic rate limiting
- Or use `next-rate-limit` or similar library

### Security Checklist

```
[ ] Remove NEXT_PUBLIC_ prefix from HA_TOKEN and HA_URL env vars
[ ] Update all server-side code to use new env var names
[ ] Create /api/auth endpoint for server-side PIN verification
[ ] Move PIN to server-side env var (DASHBOARD_PIN)
[ ] Add httpOnly session cookie on successful PIN entry
[ ] Add auth middleware to /api/camera/[id] route
[ ] Add auth middleware to /api/camera/[id]/ptz route
[ ] Add auth middleware to any other sensitive API routes
[ ] Rotate HA long-lived access token
[ ] Update .env.local with new token
[ ] Update Vercel env vars with new token and variable names
[ ] Update useHomeAssistant hook to use local API proxy instead of direct HA calls
[ ] Redeploy and verify camera feeds still work
[ ] Test that unauthenticated API requests are rejected
[ ] Add rate limiting to /api/auth endpoint
```

## Architecture

```
[Vercel Dashboard] <--HTTPS--> [Cloudflare Tunnel] <---> [Home Assistant]
                                                              |
                                                        [Docker/OrbStack]
                                                              |
                                            [Philips Hue Bridge] (direct or via proxy)
                                            [RTSP Proxy :8554] --> [Tapo Camera :554]
```

**Camera stream path:**
```
Tapo C200 (10.0.0.38:554) --> socat (Mac:8554) --> HA generic camera --> HA API proxy
--> Cloudflare Tunnel --> Next.js API route (/api/camera/[id]) --> Browser <img> tag
```

**PTZ control path:**
```
Browser --> Next.js API route (/api/camera/[id]/ptz) --> Cloudflare Tunnel
--> HA ONVIF service (onvif.ptz) --> Camera (10.0.0.38:2020)
```

## Setup Requirements

### Home Assistant (Docker on macOS with OrbStack)

Home Assistant runs in Docker via OrbStack. Due to OrbStack's network isolation, containers cannot directly reach LAN devices for some protocols. A proxy solution is required for RTSP.

**Container command:**
```bash
docker run -d \
  --name homeassistant \
  --network host \
  --restart unless-stopped \
  -e TZ=Australia/Melbourne \
  -v /Users/heathmaes/homeassistant/config:/config \
  homeassistant/home-assistant:stable
```

**Note:** The config volume path changed when moving from laptop (`/Users/clawd/...`) to desktop (`/Users/heathmaes/...`). Update accordingly.

### Camera Setup (TP-Link Tapo C200)

The Tapo C200 is a pan/tilt WiFi camera at IP `10.0.0.38` (static IP set in Tapo app).

**Tapo app prerequisites:**
1. Download Tapo app, create account, add the C200
2. In app: Me - Third Party Services - Third-Party Compatibility - On
3. In camera settings: create a **Camera Account** (username/password for RTSP)
4. In camera Network Settings: enable **Static IP**

**Camera Account credentials (for RTSP):**
- Username: `Claudeaccess`
- Password: stored in HA configuration (not committed to repo)

#### RTSP Proxy (socat)

The HA container cannot reach the camera's RTSP port directly. A socat proxy on the Mac host forwards port 8554 to the camera's port 554.

**Install socat:**
```bash
brew install socat
```

**Start RTSP proxy:**
```bash
socat TCP-LISTEN:8554,reuseaddr,fork TCP:10.0.0.38:554 &
```

Port 8554 is used instead of 554 to avoid needing root privileges.

**LaunchAgent for persistence** (`~/Library/LaunchAgents/com.tapo.camera.proxy.plist`):
```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.tapo.camera.proxy</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/socat</string>
        <string>TCP-LISTEN:8554,reuseaddr,fork</string>
        <string>TCP:10.0.0.38:554</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
```

Load it: `launchctl load ~/Library/LaunchAgents/com.tapo.camera.proxy.plist`

#### HA Generic Camera (for snapshots)

The camera stream is added via the HA UI (not YAML - newer HA versions don't support YAML `platform: generic`).

**How it was set up (via HA config flow API):**
1. Settings - Devices & Services - Add Integration - "Generic Camera"
2. Stream source: `rtsp://Claudeaccess:PASSWORD@host.docker.internal:8554/stream2`
3. Using `host.docker.internal` because HA container can't reach `10.0.0.15` (LAN IP)
4. Using `stream2` (SD, 640x360) to save bandwidth on dashboard tiles
5. Entity created: `camera.host_docker_internal`

**Important:** The RTSP URL uses `host.docker.internal` (OrbStack's host gateway), NOT the Mac's LAN IP. The container can reach the Mac host via this DNS name, and socat on the Mac forwards to the camera.

#### ONVIF Integration (for PTZ controls)

Pan/tilt control uses the built-in HA ONVIF integration (not the Tapo HACS integration - cloud auth issues).

**How it was set up (via HA config flow API):**
1. Settings - Devices & Services - Add Integration - "ONVIF"
2. Manual setup (not auto-discovery)
3. Host: `10.0.0.38`, Port: `2020` (ONVIF port)
4. Username: `Claudeaccess`, Password: camera account password
5. Entity created: `camera.garage_camera_mainstream`

**Note:** Unlike RTSP, the ONVIF connection works directly to the camera IP (10.0.0.38) from the container - no socat proxy needed for ports 443, 2020, 8800.

**PTZ service call format:**
```bash
curl -X POST \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"entity_id":"camera.garage_camera_mainstream","pan":"RIGHT","move_mode":"ContinuousMove","continuous_duration":0.5,"speed":0.5,"distance":0.3}' \
  http://localhost:8123/api/services/onvif/ptz
```

Directions: `pan` = LEFT/RIGHT, `tilt` = UP/DOWN

#### HACS (Home Assistant Community Store)

HACS is installed for future custom integrations.

**Installation:**
```bash
docker exec homeassistant bash -c "wget -O - https://get.hacs.xyz | bash -"
docker restart homeassistant
```

Then configure via HA UI: Settings - Devices & Services - Add Integration - "HACS". Requires GitHub device authorization.

### Philips Hue Bridge Integration

The Hue Bridge is at `10.0.0.2` on the LAN.

**Network reachability varies by machine:**
- **Desktop (heathmaes):** The HA container can reach the Hue Bridge directly at `10.0.0.2` - no socat proxy needed. OrbStack on this machine routes to the bridge without issues.
- **Laptop (clawd):** Required socat proxies on ports 443/80 to forward traffic to the bridge. If you're on a machine where the container can't reach `10.0.0.2`, see "Hue Bridge Proxy (Legacy)" below.

**How to add Hue to Home Assistant (use the web UI, not the API):**
1. Open Home Assistant web UI at `http://localhost:8123`
2. Settings - Devices & Services - Add Integration - search "Philips Hue"
3. Enter the bridge IP: `10.0.0.2` (or Mac IP if using proxy)
4. When prompted, press the physical button on the Hue Bridge, then click Submit in the web UI
5. HA will discover all lights, rooms, and scenes

**Why use the web UI instead of the API?** The HA config flow API for Hue requires a two-step process: first call `register` to start button-press listening, then press the bridge button and call `register` again within a short window. This consistently fails with `register_failed` due to timing issues. The web UI handles the interactive button-press flow much more reliably.

**Current setup:** 11 devices, 72 entities, 13 lights discovered. No dashboard code changes or redeployment needed - the dashboard fetches lights dynamically via the `useHomeAssistant` hook.

#### Hue Bridge Proxy (Legacy - only if bridge not directly reachable)

On some machines, OrbStack Docker containers cannot reach the Hue Bridge directly. If `docker exec homeassistant nc -zv 10.0.0.2 443` fails, you need socat proxies:

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
    <string>/Users/heathmaes/logs/cloudflared-ha.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/heathmaes/logs/cloudflared-ha-error.log</string>
</dict>
</plist>
```

**Get current tunnel URL:**
```bash
grep trycloudflare.com ~/logs/cloudflared-ha-error.log | tail -1
```

**Note:** Free tunnels get a random URL that changes on restart. When it changes, you must update:
1. HA `configuration.yaml` - `cors_allowed_origins`
2. `.env.local` - `NEXT_PUBLIC_HA_URL`
3. Vercel env vars - `NEXT_PUBLIC_HA_URL`
4. Redeploy: `vercel --prod`

### Home Assistant Configuration

**`configuration.yaml`:**
```yaml
default_config:

http:
  use_x_forwarded_for: true
  trusted_proxies:
    - 127.0.0.1
    - "::1"
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

# Camera integration - added via UI (generic camera integration)
stream:
```

**Note:** Camera entities are configured via the HA UI, not YAML. Newer HA versions do not support `platform: generic` in YAML.

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

## PIN Protection

The dashboard is protected by a PIN lock screen. The PIN is stored in `page.tsx` as `DASHBOARD_PIN`. Once entered correctly, authentication is saved to `localStorage` so the user doesn't need to re-enter it on the same browser.

**Current PIN:** `11017261`

To change the PIN, update the `DASHBOARD_PIN` constant in `src/app/page.tsx`.

## Camera Integration Details

### How Snapshots Work (No Storage Cost)

The dashboard uses **snapshot polling** - not continuous streaming. Every 3 seconds, the browser fetches a single JPEG frame from the camera via:

1. Browser calls `/api/camera/garage?t=timestamp`
2. Next.js API route (server-side) calls HA's `/api/camera_proxy/camera.host_docker_internal` with Bearer auth
3. HA fetches a frame from the RTSP stream and returns JPEG
4. API route passes JPEG back to browser
5. Browser displays in `<img>` tag via blob URL

**No images are stored anywhere.** Each snapshot is fetched live, displayed, then the previous blob URL is revoked. Zero Firebase, zero storage, zero cost.

**Why not MJPEG streaming?** Vercel Serverless Functions have timeouts (10s free tier, 60s pro). MJPEG streams are continuous and would hit these limits. Snapshot polling works within the serverless model.

### Camera Entities in Home Assistant

| Entity | Integration | Purpose |
|--------|-------------|---------|
| `camera.host_docker_internal` | Generic Camera | Snapshot proxy (RTSP via socat) |
| `camera.garage_camera_mainstream` | ONVIF | PTZ controls |

The generic camera entity provides snapshot images. The ONVIF entity provides pan/tilt motor control. Both connect to the same physical camera.

### PTZ Controls

In fullscreen camera view, a D-pad appears in the bottom-right corner for cameras with `ptz: true` in the CAMERAS array. Each tap sends a `ContinuousMove` command via the ONVIF service for 0.5 seconds.

## API Notes

### Service Domains

The dashboard uses `homeassistant.*` services instead of `light.*` services:
- `homeassistant/turn_on` - Works for all entity types
- `homeassistant/turn_off` - Works for all entity types
- `homeassistant/toggle` - Works for all entity types

This is more universal and works even when the `light` domain services aren't available.

### API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/calendar` | GET | Proxies Google Calendar iCal feed |
| `/api/camera/[id]` | GET | Proxies camera snapshot from HA (adds auth server-side) |
| `/api/camera/[id]/ptz` | POST | Sends PTZ commands to camera via HA ONVIF service |

**PTZ request body:** `{ "direction": "up" | "down" | "left" | "right" }`

## Known Limitations

### OrbStack Docker Networking
- Containers cannot directly reach LAN devices via their LAN IP (e.g., 10.0.0.15)
- Containers CAN reach `host.docker.internal` (resolves to 0.250.250.254)
- Containers CAN reach other LAN devices directly on some ports (443, 2020, 8800 work to camera at 10.0.0.38)
- RTSP port 554 requires socat proxy through `host.docker.internal`
- Use `host.docker.internal` in HA configs when the container needs to reach the Mac host

### Reolink Battery Cameras (Argus 3 Pro, etc.)
- Battery-powered Reolink cameras are **cloud-only**
- They do NOT support RTSP, RTMP, HTTP, HTTPS, or ONVIF protocols
- Cannot be integrated with Home Assistant locally
- Alternative: Use wired Reolink PoE cameras which have local APIs

### TP-Link Tapo Cameras
- Tapo cameras (C200, C210, C510W, C320WS, etc.) **DO support RTSP and ONVIF**
- **Setup steps:**
  1. In Tapo app: Me - Third Party Services - Third-Party Compatibility - On
  2. Create a Camera Account (separate username/password for RTSP)
  3. RTSP URL: `rtsp://username:password@CAMERA_IP:554/stream1` (HD) or `stream2` (SD)
  4. Set static IP in Tapo app Network Settings
- **Tapo HACS integration (tapo_control) cloud auth issue:** The integration requires TP-Link cloud account credentials. If auth fails with `invalid_auth_cloud`, this may be due to two-step verification or account format issues. Use the built-in ONVIF integration for PTZ instead.
- **ONVIF works well:** Built-in HA ONVIF integration on port 2020 handles PTZ control without cloud auth issues
- **HA generic camera YAML not supported:** Newer HA versions require generic camera to be set up via the UI config flow, not `configuration.yaml`
- **Known issues:** Firmware updates occasionally break HA integration temporarily
- **Tip:** Set static IP for camera in router/app to avoid connection issues

### Swann EVO WiFi Cameras (Not Recommended)
- Standalone WiFi models (like SWIFI-SE2KPT) primarily work through the Swann Security App
- RTSP/ONVIF support is mainly documented for NVR-based systems, not standalone WiFi cameras
- Risky for local Home Assistant integration - likely cloud-dependent

### Apple TV Integration
- Requires proper network access from Home Assistant container
- With OrbStack, would need proxy setup similar to Hue Bridge
- The integration can only control media playback, NOT power off the TV hardware
- Apple TV sleep mode uses ~0.5W, so powering off isn't necessary

### Smart Plugs and TVs
- Not recommended to hard-cut power to Apple TV/smart TVs regularly
- Can interrupt updates and cause minor flash storage wear
- Better to use sleep commands or let devices sleep naturally

### Google Calendar Integration

**OAuth Method (Complex)**
- Requires Google Cloud Console project with Calendar API enabled
- Create OAuth 2.0 credentials (Web application type)
- Redirect URI must match exactly: `https://my.home-assistant.io/redirect/oauth`
- **Issue with Cloudflare Tunnel**: If accessing HA via Cloudflare Tunnel instead of `my.home-assistant.io`, you'll get `redirect_uri_mismatch` errors
- The OAuth flow expects the standard Home Assistant Cloud redirect

**iCal Method (Recommended)**
- Use Google Calendar's "Secret address in iCal format" (NOT public address)
- The secret URL contains a long random token - secure but not indexed/discoverable
- Dashboard fetches via `/api/calendar` route which proxies the iCal feed
- To get the secret iCal URL:
  1. Google Calendar - Settings - Click your calendar
  2. Scroll to "Integrate calendar"
  3. Copy "Secret address in iCal format" (ends with `.ics`)
- Update the URL in `/src/app/api/calendar/route.ts`

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
2. Check tunnel URL hasn't changed: `grep trycloudflare.com ~/logs/cloudflared-ha-error.log | tail -1`
3. Update Vercel env vars if URL changed, then redeploy

### Lights Show "Unavailable"
1. Check if HA container can reach the Hue Bridge directly: `docker exec homeassistant nc -zv 10.0.0.2 443`
2. If direct access fails, check Hue Bridge proxy is running: `lsof -i :443 | grep socat`
3. Restart proxies if needed (only required if bridge not directly reachable)
4. Check Home Assistant Hue integration status in Settings - Devices & Services
5. If integration shows an error, try removing and re-adding it via the web UI (press bridge button when prompted)

### Camera Shows "Offline"
1. Check socat RTSP proxy is running: `lsof -i :8554 | grep socat`
2. If not running: `socat TCP-LISTEN:8554,reuseaddr,fork TCP:10.0.0.38:554 &`
3. Check HA container can reach the proxy: `docker exec homeassistant nc -zv host.docker.internal 8554`
4. Check camera entity state: `curl -H "Authorization: Bearer TOKEN" http://localhost:8123/api/states/camera.host_docker_internal`
5. Test snapshot directly: `curl -o test.jpg -H "Authorization: Bearer TOKEN" http://localhost:8123/api/camera_proxy/camera.host_docker_internal`

### PTZ Controls Not Working
1. Check ONVIF entity exists: `curl -H "Authorization: Bearer TOKEN" http://localhost:8123/api/states/camera.garage_camera_mainstream`
2. Test PTZ directly: `curl -X POST -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d '{"entity_id":"camera.garage_camera_mainstream","pan":"RIGHT","move_mode":"ContinuousMove","continuous_duration":0.5}' http://localhost:8123/api/services/onvif/ptz`
3. Verify camera is reachable on ONVIF port: `docker exec homeassistant nc -zv 10.0.0.38 2020`

### Tunnel URL Changed After Restart
Free Cloudflare tunnels get a random URL each time. When it changes:
1. Get new URL: `grep trycloudflare.com ~/logs/cloudflared-ha-error.log | tail -1`
2. Update HA config: add new URL to `cors_allowed_origins` in `configuration.yaml`
3. Restart HA: `docker restart homeassistant`
4. Update `.env.local`: change `NEXT_PUBLIC_HA_URL`
5. Update Vercel: `echo "NEW_URL" | vercel env rm NEXT_PUBLIC_HA_URL production && echo "NEW_URL" | vercel env add NEXT_PUBLIC_HA_URL production`
6. Redeploy: `vercel --prod`

### Safari vs Chrome Issues
- Safari may have stricter CORS handling
- Ensure the tunnel URL is in Home Assistant's `cors_allowed_origins`
- Try clearing site data and re-entering credentials

### Token Format
- Long-lived access tokens must be entered as one continuous string
- No spaces or line breaks
- Format: `eyJhbG...` (183 characters, 3 parts separated by dots)

### curl with Special Characters
- Passwords containing underscores or special characters can break `curl -d` inline JSON
- Fix: Write the JSON payload to a temp file and use `curl -d @/tmp/payload.json` instead

### HA Config Flow API vs Web UI
- Some integrations (Hue, Generic Camera) are easier to set up via the HA web UI than the REST API
- The API config flow requires multi-step exchanges with precise timing (especially for Hue button press)
- When in doubt, use `http://localhost:8123` and add integrations through Settings - Devices & Services

### Calendar Shows "No upcoming events"
1. Verify the iCal URL is correct in `/src/app/api/calendar/route.ts`
2. Use the **secret** iCal address, not public embed URL
3. Test the iCal URL directly: `curl "YOUR_ICAL_URL" | head -50`
4. Ensure events are within the next 14 days
5. Check Vercel function logs: `vercel logs --follow`

## File Structure

```
home-dashboard/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── calendar/
│   │   │   │   └── route.ts       # Google Calendar iCal proxy
│   │   │   └── camera/
│   │   │       └── [id]/
│   │   │           ├── route.ts    # Camera snapshot proxy (GET)
│   │   │           └── ptz/
│   │   │               └── route.ts # PTZ control (POST)
│   │   ├── layout.tsx
│   │   ├── globals.css              # Glassmorphism styles, animations
│   │   └── page.tsx                 # Main dashboard (PIN, cameras, lights, PTZ)
│   └── lib/
│       ├── homeassistant.ts         # HA API integration
│       └── useHomeAssistant.ts      # React hook for HA
├── public/
│   └── rooms/                       # Room layout images
│       └── office.jpg
├── .env.local                       # HA URL and token
└── README.md
```

## Related Services

| Service | Location | Purpose |
|---------|----------|---------|
| Home Assistant | Docker (OrbStack) | Smart home hub |
| Hue Bridge | 10.0.0.2 (direct or via proxy) | Philips Hue lights (13 lights, 11 devices) |
| Tapo C200 | 10.0.0.38 (static IP) | Garage camera (RTSP + ONVIF) |
| Cloudflare Tunnel | Mac | Remote HTTPS access |
| Vercel | Cloud | Dashboard hosting |
| Google Calendar | Cloud (iCal) | Family calendar events |
| HACS | HA custom component | Community integrations store |

## Useful Commands

```bash
# Check all services
docker ps                                    # Home Assistant container
pgrep cloudflared                            # Cloudflare tunnel
lsof -i :80 -i :443 | grep socat            # Hue Bridge proxies
lsof -i :8554 | grep socat                  # Camera RTSP proxy

# Restart Home Assistant
docker restart homeassistant

# View Home Assistant logs
docker logs homeassistant --tail 50

# Test Home Assistant API
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/

# Test camera snapshot
curl -o snapshot.jpg -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/camera_proxy/camera.host_docker_internal

# Test PTZ (pan right)
curl -X POST -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" \
  -d '{"entity_id":"camera.garage_camera_mainstream","pan":"RIGHT","move_mode":"ContinuousMove","continuous_duration":0.5}' \
  http://localhost:8123/api/services/onvif/ptz

# List all camera entities
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/states | \
  python3 -c "import json,sys; [print(e['entity_id'],e['state']) for e in json.load(sys.stdin) if 'camera' in e['entity_id']]"

# List all light entities
curl -s -H "Authorization: Bearer YOUR_TOKEN" http://localhost:8123/api/states | \
  python3 -c "import json,sys; [print(e['entity_id'],e['state']) for e in json.load(sys.stdin) if e['entity_id'].startswith('light.')]"

# Check Hue Bridge reachability from container
docker exec homeassistant nc -zv 10.0.0.2 443

# Redeploy to Vercel
vercel --prod

# Get current tunnel URL
grep trycloudflare.com ~/logs/cloudflared-ha-error.log | tail -1
```
