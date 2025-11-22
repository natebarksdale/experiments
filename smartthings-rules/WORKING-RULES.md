# Working SmartThings HVAC Rules

## ⚠️ Rules API Limitations Discovered

After testing, we discovered a critical limitation: **The SmartThings Rules API cannot compare two device attributes to each other** (e.g., temperature vs setpoint).

### What Doesn't Work
❌ Comparing `temperature` to `heatingSetpoint`
❌ Comparing `temperature` to `coolingSetpoint`
❌ Dynamic, temperature-based decision making

The API only supports comparing a device attribute to a **constant value** (string, integer).

### What DOES Work
✅ Detecting mode conflicts (heat vs cool)
✅ Comparing temperature to fixed thresholds
✅ Event-driven triggers on mode changes
✅ Synchronizing zones based on mode

## Working Solution: Smart Sync Rules

These rules provide the best compromise within Rules API constraints:

**Files:**
- `hvac-loop1-smart-sync.json` - Front Loop
- `hvac-loop2-smart-sync.json` - Back Loop

### How They Work

**Trigger**: Any thermostat mode changes to heat or cool
**Check**: Are there conflicting modes? (both heat AND cool present)
**Action**: If conflict detected, turn OFF all zones

This is identical to the original conflict resolver, but with explicit `"trigger": true` attributes for reliability.

## Why This Approach

1. **Safe**: Prevents compressor damage instantly
2. **Event-driven**: Triggers on mode changes, not schedule
3. **Works within API**: Uses only supported comparisons
4. **Fast**: < 1 second response time
5. **Pairs with GitHub Actions**: Your existing workflow provides the intelligence

## Architecture Recommendation

**Use a two-tier approach:**

### Tier 1: SmartThings Rules (Safety & Sync)
```
User changes mode → Conflict detected? → Turn off loop
```
- **Purpose**: Instant conflict prevention
- **Response**: < 1 second
- **Intelligence**: Basic (conflict detection only)

### Tier 2: GitHub Actions (Intelligence & Control)
```
Every 15 min → Analyze temps → Calculate optimal mode → Set zones
```
- **Purpose**: Smart temperature-based decisions
- **Response**: Up to 15 minutes
- **Intelligence**: Advanced (delta-weighted, occupancy-aware)

## Why Temperature Intelligence Needs GitHub Actions

The Rules API cannot:
- ❌ Compare temperature to setpoints dynamically
- ❌ Calculate temperature deltas
- ❌ Weight zones by demand
- ❌ Consider occupancy (lights)
- ❌ Integrate weather data
- ❌ Make multi-factor decisions

Your existing `hvac-control-logic.js` CAN do all of this! It already implements:
- ✅ Temperature delta calculation
- ✅ Weighted demand (heat vs cool)
- ✅ Priority-based decisions
- ✅ Conflict resolution logic
- ✅ Zone satisfaction analysis

## Deployment

### Option 1: Just Use GitHub Actions
Your existing workflow already handles everything intelligently. The SmartThings Rules are optional safety nets.

**Pros:**
- Simple (one system)
- Fully intelligent
- Already working

**Cons:**
- 15-minute delay
- External dependency

### Option 2: Hybrid (Recommended)
Deploy both systems for complementary operation:

**SmartThings Rules:**
```bash
smartthings rules:create -i hvac-loop1-smart-sync.json
smartthings rules:create -i hvac-loop2-smart-sync.json
```

**GitHub Actions:**
Already deployed (`.github/workflows/poll-thermostat.yml`)

**How they work together:**
1. User manually sets conflicting modes → Rules turn off loop immediately
2. 15 minutes later → GitHub Actions analyzes temperatures
3. GitHub Actions sets optimal mode → All zones synchronized
4. If manual override creates conflict → Rules catch it again

### Option 3: Enhanced GitHub Actions
Add webhook support to your existing script for near-real-time alerts:

```javascript
// In poll-thermostat.js, after detecting conflicts:
if (analysis.allActions.length > 0) {
  await fetch('YOUR_WEBHOOK_URL', {
    method: 'POST',
    body: JSON.stringify({
      alert: 'HVAC conflict detected',
      loop: loopId,
      actions: analysis.allActions
    })
  });
}
```

## Testing

### Test the Smart Sync Rules

1. Deploy Loop 2 rule
2. Manually set Basement to HEAT
3. Manually set Main Kitchen to COOL
4. **Expected**: Both turn OFF within 1 second
5. Wait 15 minutes
6. **Expected**: GitHub Actions rebalances based on temperatures

## Summary: Rules API Can't Do Temperature Logic

The Rules API is designed for:
- ✅ Simple automations
- ✅ Mode/state-based triggers
- ✅ Fixed thresholds
- ✅ Device control

It's NOT designed for:
- ❌ Complex decision trees
- ❌ Multi-attribute comparisons
- ❌ Dynamic setpoint logic
- ❌ Weighted calculations

**Your GitHub Actions workflow is already the right solution for intelligent temperature control!**

The SmartThings Rules can only add a safety layer for instant conflict detection, not replace the sophisticated logic you've already built.

## Sources

- [SmartThings Rules Documentation](https://developer.smartthings.com/docs/automations/rules)
- [Sample-RulesAPI GitHub](https://github.com/SmartThingsDevelopers/Sample-RulesAPI)
- [Rules API Community](https://community.smartthings.com/c/developer-programs/rules-api/101)
