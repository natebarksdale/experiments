# HVAC Loop Synchronization Rules

These SmartThings Rules automatically detect and resolve conflicts in your HVAC loops. Since each loop shares a single compressor, all zones on a loop must be in the same mode (heat/cool) or off.

## Rules Overview

### Loop 1 (Front Loop) - Conflict Resolver
**Zones**: Front Hall, Primary Bedroom, NB's Office, Den

**Device IDs**:
- Front Hall: `999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147`
- Primary Bedroom: `9ced4ff7-4376-47c8-b882-5724bfb14306`
- NB's Office: `8021826e-78ca-4f3d-bd33-bdac1cadd3f2`
- Den: `87f9fbe2-f6b7-4877-9486-01b896a0acb5`

### Loop 2 (Back Loop) - Conflict Resolver
**Zones**: Basement, JR's Office, Main Kitchen, Kids Bedroom

**Device IDs**:
- Basement: `8051fd90-ab24-467c-8746-3dadbce02252`
- JR's Office: `c44c9f12-1029-43c0-af5f-a5ff572d37c7`
- Main Kitchen: `dd6b54be-a667-4acc-a112-d89c9923c29d`
- Kids Bedroom: `8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd`

## How They Work

### Conflict Detection Logic

The rules continuously monitor all thermostats in each loop. When a conflict is detected, they take immediate action:

**Conflict = (At least one zone in HEAT mode) AND (At least one zone in COOL mode)**

### Conflict Resolution Strategy

When a conflict is detected, the rule immediately **turns OFF all zones on that loop**.

**Why turn everything off?**
1. **Safety**: Prevents damage to the shared HVAC compressor
2. **Simplicity**: Reliable and fast response
3. **Works with existing automation**: Your GitHub Actions workflow runs every 15 minutes and will intelligently rebalance the zones based on actual temperature needs

### Event-Driven Execution

These rules are **event-driven**, not schedule-based:
- They trigger instantly when any thermostat mode changes
- No polling interval needed
- Near-zero latency response to conflicts
- Only execute when necessary (energy efficient)

## Integration with Existing System

Your current setup already has sophisticated logic in `hvac-control-logic.js` that:
- Analyzes temperature deltas
- Weighs conflicting demands
- Prioritizes zones with greatest need
- Makes intelligent mode decisions

These SmartThings Rules complement that by providing:
- **Real-time conflict prevention** (immediate response)
- **Safety net** (prevents compressor damage)
- **Bridge to smart rebalancing** (turns off conflicts, lets GitHub Actions workflow rebalance properly)

## Workflow

```
User changes thermostat mode manually
           ↓
SmartThings Rule detects change
           ↓
Conflict detected? (heat + cool on same loop)
           ↓
YES → Turn off all zones on that loop
           ↓
GitHub Actions runs (every 15 min)
           ↓
Analyzes all temperatures and demands
           ↓
Determines optimal loop mode
           ↓
Turns on zones in synchronized mode
```

## Deployment

### Option 1: SmartThings Web App (Recommended)
1. Go to https://my.smartthings.com
2. Navigate to Automations > Rules
3. Click "Create Rule"
4. Paste JSON from `hvac-loop1-conflict-resolver.json`
5. Save and enable
6. Repeat for Loop 2

### Option 2: SmartThings CLI
```bash
smartthings login
smartthings rules:create -i hvac-loop1-conflict-resolver.json
smartthings rules:create -i hvac-loop2-conflict-resolver.json
```

### Option 3: API
```bash
curl -X POST https://api.smartthings.com/v1/rules \
  -H "Authorization: Bearer $SMARTTHINGS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @hvac-loop1-conflict-resolver.json
```

## Testing

### Test Scenario 1: Create a Conflict
1. Manually set Basement thermostat to HEAT mode
2. Manually set Main Kitchen thermostat to COOL mode
3. **Expected**: Within seconds, both should turn OFF
4. Wait for next GitHub Actions run (~15 min)
5. **Expected**: Workflow analyzes needs and sets appropriate mode

### Test Scenario 2: Same Mode Changes
1. Set Basement to HEAT
2. Set JR's Office to HEAT
3. **Expected**: No action (both in same mode = no conflict)

### Test Scenario 3: Mixed with OFF
1. Set Basement to HEAT
2. Set Main Kitchen to OFF
3. Set Kids Bedroom to COOL
4. **Expected**: Both Basement and Kids Bedroom turn OFF (conflict detected)

## Advantages Over Schedule-Based Rules

| Feature | Event-Driven (These Rules) | Schedule-Based (Every 15min) |
|---------|---------------------------|------------------------------|
| Response Time | Instant (< 1 second) | Up to 15 minutes |
| Resource Usage | Only when needed | Every 15 min regardless |
| Conflict Resolution | Immediate | Delayed |
| Compressor Safety | High | Medium |
| Battery Impact | Minimal | Higher |

## Monitoring

### Check Rule Execution
```bash
# List rules
smartthings rules

# Get execution history
smartthings rules:history RULE_ID
```

### Check Logs
In the SmartThings app:
1. Go to Menu > Settings > Labs
2. Enable "Advanced Web App"
3. View automation execution logs

## Troubleshooting

**Rule not executing**
- Verify all device IDs are correct
- Check that thermostats support thermostatMode capability
- Ensure rule is enabled

**All zones keep turning off**
- This is expected when there's a persistent conflict
- Check if someone is manually overriding the modes
- Verify GitHub Actions workflow is running to rebalance

**Rule conflicts with manual changes**
- This is by design - the rule prevents compressor damage
- If you need to override, disable the rule temporarily
- Consider adjusting the logic in your GitHub Actions workflow instead

## Advanced: Customizing the Logic

If you want different behavior instead of turning everything off, you could modify the `then` action to:

**Option 1: Prioritize Cooling**
```json
"then": [{
  "command": {
    "devices": ["ALL-DEVICE-IDS"],
    "commands": [{
      "component": "main",
      "capability": "thermostatMode",
      "command": "cool"
    }]
  }
}]
```

**Option 2: Keep First Mode** (more complex, requires multiple nested if statements)

**Option 3: Turn off only conflicting zone** (requires identifying which changed last - complex)

## Combining with GitHub Actions

Your existing workflow (`poll-thermostat.js`) already handles:
- ✅ Temperature analysis
- ✅ Demand calculation
- ✅ Priority-based decisions
- ✅ Intelligent rebalancing

These SmartThings Rules add:
- ✅ Instant conflict detection
- ✅ Immediate safety response
- ✅ Event-driven execution

Together they create a robust system:
- **SmartThings Rules**: Fast safety net (seconds)
- **GitHub Actions**: Smart optimization (minutes)

## Future Enhancements

Possible improvements:
1. Add temperature threshold checks before turning off
2. Implement "cooldown" period to prevent rapid on/off cycling
3. Add notifications when conflicts are detected
4. Create separate rules for overcooling/overheating detection

## Notes

- These rules are **non-destructive** - they only change thermostat modes, not setpoints
- They work alongside your existing automations
- They can be enabled/disabled independently per loop
- They have no external dependencies (no API calls, webhooks, etc.)
- They execute locally on SmartThings hub when possible (fast)

## Schema Details

The rules use:
- **Trigger**: Implicit (evaluates whenever device state changes)
- **Condition**: `if` with nested `and`/`or` logic
- **Action**: `command` to set thermostat mode
- No schedule needed - purely event-driven

This makes them extremely efficient and responsive compared to polling-based solutions.
