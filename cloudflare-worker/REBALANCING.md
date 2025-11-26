# HVAC Rebalancing System

This system automatically monitors and rebalances your HVAC zones to prevent inefficiencies and conflicts.

## How It Works

### 1. Monitoring & Analysis

The Cloudflare Worker continuously tracks HVAC device states (temperature, mode, setpoints) with minimal KV writes:

- **1 KV write per device event** - Optimized to stay within 1000 operations/day limit
- **Tracks ~8 HVAC devices** = ~125 events per device per day capacity
- **No switch tracking** - Focus only on thermostats and temperature sensors

### 2. Rebalancing Logic

The system detects and corrects two types of problems:

#### Inefficiencies
- **Overcooling**: Unit in COOL mode when temp is 2°F+ below setpoint
- **Overheating**: Unit in HEAT mode when temp is 2°F+ above setpoint
- **Action**: Turns off the inefficient unit

#### Conflicts
- **Heating vs Cooling**: Some zones heating while others cooling
- **Resolution Strategy**:
  - If any cooling zone is 5°F+ above setpoint: Turn off all heating zones
  - Otherwise: Turn off zones that have reached their target (±2°F hysteresis)

### 3. Scheduled Execution

Rebalancing runs automatically:

- **9:00 AM ET** (14:00 UTC)
- **6:00 PM ET** (23:00 UTC)

Configured via Cloudflare Cron Triggers in `wrangler-smartapp.toml`.

### 4. Manual Triggering

Trigger rebalancing anytime via webhook:

```bash
curl https://your-worker.workers.dev/rebalance
```

This can be called from:
- SmartThings automation (via webhook)
- Home Assistant
- Any HTTP client

## Configuration

### Default Setpoints

Defined in `smartapp-webhook-worker.js`:

```javascript
const REBALANCE_CONFIG = {
  DEFAULT_HEAT_SETPOINT: 68,  // °F
  DEFAULT_COOL_SETPOINT: 72,  // °F
  HYSTERESIS: 2,              // °F - buffer to prevent oscillation
  SIGNIFICANT_OVERHEAT: 5     // °F - threshold for favoring cooling
};
```

### Adjusting Schedule

Edit `wrangler-smartapp.toml`:

```toml
[triggers]
crons = [
  "0 14 * * *",  # 9:00 AM ET
  "0 23 * * *"   # 6:00 PM ET
]
```

## Command Execution

The worker analyzes device states and writes commands to KV. A separate script executes them.

### Setup Command Executor

1. **Create SmartThings Personal Access Token**:
   - Visit: https://account.smartthings.com/tokens
   - Required scopes: `r:devices:*`, `x:devices:*`

2. **Set Environment Variables**:
   ```bash
   export SMARTTHINGS_PAT="your-personal-access-token"
   export WORKER_URL="https://your-worker.workers.dev"
   ```

3. **Run Manually**:
   ```bash
   node execute-rebalance-commands.js
   ```

4. **Schedule with Cron** (runs every 15 minutes):
   ```bash
   crontab -e
   # Add:
   */15 * * * * /usr/bin/node /path/to/execute-rebalance-commands.js >> /var/log/hvac-rebalance.log 2>&1
   ```

## API Endpoints

### GET /rebalance
Trigger rebalancing analysis and generate commands.

**Response**:
```json
{
  "timestamp": "2025-11-26T14:00:00.000Z",
  "analysis": {
    "totalDevices": 8,
    "conflicts": [...],
    "inefficiencies": [...],
    "summary": "Found 1 conflicts and 2 inefficiencies"
  },
  "commands": [
    {
      "deviceId": "xxx",
      "action": "setThermostatMode",
      "value": "off",
      "reason": "Unit is cooling but temp is 3°F below setpoint"
    }
  ],
  "executed": false
}
```

### GET /rebalance-status
Check last rebalancing run.

**Response**:
```json
{
  "lastRun": "2025-11-26T14:00:00.000Z",
  "commandCount": 3,
  "summary": "Found 1 conflicts and 2 inefficiencies"
}
```

### GET /rebalance-commands
Get pending commands.

**Response**: Same as `/rebalance` but doesn't trigger new analysis.

## KV Storage Structure

```
device:{deviceId}           - Current device state
rebalance:commands          - Pending rebalancing commands
rebalance:status            - Last rebalancing status
install:{installedAppId}    - SmartApp installation config
```

## Deployment

Deploy the updated worker:

```bash
cd /home/user/experiments/cloudflare-worker
wrangler deploy --config wrangler-smartapp.toml
```

Cron triggers are automatically enabled after deployment.

## Monitoring

Check logs in Cloudflare Dashboard:
- Workers & Pages → your-worker → Logs → Real-time Logs

Or via wrangler:
```bash
wrangler tail --config wrangler-smartapp.toml
```

## Troubleshooting

**Problem**: Commands not executing
- **Solution**: Verify `execute-rebalance-commands.js` is running via cron
- Check: `SMARTTHINGS_PAT` and `WORKER_URL` environment variables

**Problem**: Exceeding KV write limits
- **Solution**: Reduce tracked devices to HVAC only (already done)
- Check: Current usage in Cloudflare Dashboard → KV → your-namespace → Metrics

**Problem**: Wrong timezone for scheduled runs
- **Solution**: Adjust cron times in `wrangler-smartapp.toml`
- Remember: Cron uses UTC, not ET

## Future Enhancements

- [ ] Add POST endpoint to mark commands as executed
- [ ] Implement command retry logic
- [ ] Add notifications when conflicts are detected
- [ ] Support multiple HVAC loops with independent control
- [ ] Add web dashboard for monitoring and manual control
