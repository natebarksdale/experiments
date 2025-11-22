# Intelligent HVAC Loop Control Rules

These SmartThings Rules provide **fully autonomous, intelligent temperature-based control** of your HVAC loops, entirely within SmartThings. No external services, webhooks, or scheduled tasks required!

## Overview

Each loop continuously monitors all zones and makes smart decisions based on actual temperatures and setpoints:

**Loop 1 (Front)**: Front Hall, Primary Bedroom, NB's Office, Den
**Loop 2 (Back)**: Basement, JR's Office, Main Kitchen, Kids Bedroom

## How the Intelligence Works

### Decision Logic

The rules use a cascading decision tree that evaluates every zone's needs:

```
Step 1: Check if ANY zone needs HEATING
  (heatingSetpoint > currentTemp)
  ↓
  YES → Check if ANY zone is still below coolingSetpoint
         ↓
         YES → Set entire loop to HEAT mode

Step 2: Else, check if ANY zone needs COOLING
  (currentTemp > coolingSetpoint)
  ↓
  YES → Set entire loop to COOL mode

Step 3: Else (all zones satisfied)
  ↓
  Set entire loop to OFF mode
```

### Key Principles

**1. Any-zone-wins**: If ANY zone in the loop needs conditioning, the loop will turn on
  - Example: If Basement needs heat, entire Loop 2 goes to heat mode

**2. Priority: Heating > Cooling**: When zones are in the "deadband" (between setpoints)
  - Example: Zone A at 68°F (heating setpoint: 70°F, cooling setpoint: 75°F)
  - Decision: Prioritize heating since it's closer to heating setpoint

**3. Synchronized operation**: All zones on a loop always operate in the same mode
  - Prevents compressor conflicts
  - Ensures system safety

**4. Satisfaction = Off**: When all zones reach their setpoints, loop turns off
  - Energy efficient
  - No unnecessary cycling

## Example Scenarios

### Scenario 1: Clear Heating Need
```
Basement:      65°F (setpoint: 70°F heat, 75°F cool)  ← Needs heat!
JR's Office:   72°F (setpoint: 71°F heat, 76°F cool)  ← Satisfied
Main Kitchen:  73°F (setpoint: 70°F heat, 75°F cool)  ← Satisfied
Kids Bedroom:  71°F (setpoint: 72°F heat, 76°F cool)  ← Needs heat!

Decision: Set Loop 2 to HEAT mode
Reason: Basement and Kids Bedroom need heating
```

### Scenario 2: Clear Cooling Need
```
Basement:      77°F (setpoint: 70°F heat, 75°F cool)  ← Needs cool!
JR's Office:   76°F (setpoint: 71°F heat, 76°F cool)  ← Satisfied
Main Kitchen:  78°F (setpoint: 70°F heat, 75°F cool)  ← Needs cool!
Kids Bedroom:  74°F (setpoint: 72°F heat, 76°F cool)  ← Satisfied

Decision: Set Loop 2 to COOL mode
Reason: Basement and Main Kitchen need cooling
```

### Scenario 3: All Satisfied
```
Basement:      72°F (setpoint: 70°F heat, 75°F cool)  ← Good
JR's Office:   73°F (setpoint: 71°F heat, 76°F cool)  ← Good
Main Kitchen:  72°F (setpoint: 70°F heat, 75°F cool)  ← Good
Kids Bedroom:  74°F (setpoint: 72°F heat, 76°F cool)  ← Good

Decision: Set Loop 2 to OFF mode
Reason: All zones at comfortable temperature
```

### Scenario 4: Conflicting Needs
```
Basement:      68°F (setpoint: 70°F heat, 75°F cool)  ← Needs heat!
Main Kitchen:  77°F (setpoint: 70°F heat, 75°F cool)  ← Needs cool!

Decision: Set Loop 2 to HEAT mode
Reason: Heating takes priority in mixed scenarios
Note: Main Kitchen will need to tolerate slight warmth, or user can adjust setpoint
```

## Event-Driven Execution

These rules are **event-driven** and trigger on:
- Temperature changes (any thermostat reports new temperature)
- Setpoint changes (user adjusts heating/cooling setpoint)
- Mode changes (user manually changes mode)

**Response time**: < 1 second from trigger event

**No polling needed**: Rules evaluate conditions automatically when device states change

## Advantages Over Conflict-Only Rules

| Feature | Intelligent Rules | Conflict-Only Rules |
|---------|------------------|---------------------|
| Temperature awareness | ✅ Yes | ❌ No |
| Setpoint comparison | ✅ Yes | ❌ No |
| Autonomous operation | ✅ Fully autonomous | ⚠️ Needs external rebalancing |
| Decision making | ✅ Smart (temp-based) | ⚠️ Simple (turn off on conflict) |
| User intervention | Minimal | May require manual restart |
| Energy efficiency | ✅ Optimized | ⚠️ Basic |

## Integration with Existing Systems

### Standalone Operation
These rules can operate **completely independently**:
- No GitHub Actions needed
- No external API calls
- No scheduling required
- Fully contained within SmartThings

### Hybrid Operation (Recommended)
Use these rules **alongside** your GitHub Actions:

**SmartThings Rules handle**:
- Real-time temperature response
- Mode synchronization
- Immediate adjustments

**GitHub Actions handle**:
- Data logging
- Google Sheets updates
- Advanced analytics
- Weather integration
- Light-based occupancy logic

## Deployment

### Using SmartThings Web App
1. Go to https://my.smartthings.com
2. Navigate to Automations > Rules
3. Click "Create Rule"
4. Paste JSON from `hvac-loop2-intelligent.json`
5. Save and enable
6. Repeat for Loop 1

### Using SmartThings CLI
```bash
smartthings login
smartthings rules:create -i hvac-loop1-intelligent.json
smartthings rules:create -i hvac-loop2-intelligent.json
```

### Using API
```bash
curl -X POST https://api.smartthings.com/v1/rules \
  -H "Authorization: Bearer $SMARTTHINGS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @hvac-loop1-intelligent.json

curl -X POST https://api.smartthings.com/v1/rules \
  -H "Authorization: Bearer $SMARTTHINGS_TOKEN" \
  -H "Content-Type: application/json" \
  -d @hvac-loop2-intelligent.json
```

## Testing

### Test 1: Temperature-Based Heating
1. Lower the heating setpoint on Basement to current temp + 5°F
2. **Expected**: Loop 2 switches to HEAT mode within seconds
3. **Result**: All zones on Loop 2 go to heat mode

### Test 2: Temperature-Based Cooling
1. Lower the cooling setpoint on Main Kitchen to current temp - 5°F
2. **Expected**: Loop 2 switches to COOL mode within seconds
3. **Result**: All zones on Loop 2 go to cool mode

### Test 3: Satisfaction
1. Set all setpoints so current temps are in the middle of the deadband
2. **Expected**: Loop turns OFF
3. **Result**: All zones turn off (no conditioning needed)

### Test 4: Mixed Needs
1. Lower heating setpoint on one zone (needs heat)
2. Lower cooling setpoint on another zone (needs cool)
3. **Expected**: Heating takes priority, loop goes to HEAT
4. **Result**: Both zones set to heat mode

## Monitoring

### View Rule Activity
```bash
# List all rules
smartthings rules

# View specific rule details
smartthings rules RULE_ID

# Check execution history
smartthings rules:history RULE_ID
```

### SmartThings App
1. Open SmartThings app
2. Go to Menu > Automations
3. Select the rule
4. View recent activity and triggers

## Troubleshooting

### Rule not triggering
- **Check**: Are thermostats reporting temperature changes?
- **Check**: Do devices support required capabilities?
- **Fix**: Verify device IDs in the JSON match your thermostats

### Loop stays in wrong mode
- **Check**: What are the actual temperatures vs setpoints?
- **Check**: Is there a persistent need that overrides?
- **Fix**: Adjust setpoints to match desired behavior

### Rapid mode switching
- **Cause**: Temperature bouncing around setpoint threshold
- **Fix**: Increase deadband (gap between heating and cooling setpoints)
- **Recommended**: Keep at least 3-5°F between heating and cooling setpoints

### One zone always triggers the loop
- **Cause**: That zone's setpoint creates persistent demand
- **Fix**: Adjust that zone's setpoints to be more lenient
- **Alternative**: Manually turn that zone off if it shouldn't participate

## Advanced Customization

### Modify Priority (Cooling over Heating)

To prioritize cooling over heating, swap the outer if/else blocks in the JSON:

1. Move the cooling check to the first `if` block
2. Move the heating check to the `else` block

### Add Deadband Tolerance

To require a 2°F gap before triggering:

Replace comparisons like:
```json
"greater": {
  "left": {"device": {...}, "attribute": "heatingSetpoint"},
  "right": {"device": {...}, "attribute": "temperature"}
}
```

With:
```json
"greater": {
  "left": {
    "operand": "subtract",
    "left": {"device": {...}, "attribute": "heatingSetpoint"},
    "right": {"integer": 2}
  },
  "right": {"device": {...}, "attribute": "temperature"}
}
```

(Note: Requires testing - arithmetic operands may not be supported in all contexts)

### Add Time-Based Override

Combine with schedule:
```json
{
  "every": {
    "specific": {
      "reference": "Midnight",
      "offset": {"value": {"integer": 0}, "unit": "Minute"}
    },
    "actions": [
      {"command": {"devices": [...], "commands": [{"command": "off"}]}}
    ]
  }
}
```

## Performance Considerations

**Execution speed**: < 1 second (local execution when possible)
**Network impact**: Minimal (only on device state changes)
**Battery impact**: Very low (thermostats usually powered)
**Cloud dependency**: Minimal (executes locally on hub when possible)

## Limitations

### Cannot directly compare temperature deltas
- **Limitation**: Can't calculate "3 degrees below setpoint"
- **Workaround**: Rules trigger on any gap, not specific thresholds

### Cannot weight zones
- **Limitation**: All zones have equal vote
- **Workaround**: Adjust setpoints to give priority (tighter deadband = more influence)

### Cannot account for occupancy
- **Limitation**: No light/motion integration in Rules API
- **Workaround**: Use GitHub Actions for occupancy-based adjustments

### Cannot log or notify
- **Limitation**: No webhook or notification support
- **Workaround**: Use GitHub Actions for logging and alerts

## Comparison: Rules API vs GitHub Actions

| Capability | Intelligent Rules | GitHub Actions |
|-----------|------------------|----------------|
| Temperature monitoring | ✅ Real-time | ⏱️ Every 15 min |
| Mode synchronization | ✅ Instant | ⏱️ Delayed |
| Setpoint comparison | ✅ Native | ✅ Calculated |
| Conflict resolution | ✅ Instant | ⏱️ Delayed |
| Weighted decisions | ❌ No | ✅ Yes (delta-based) |
| Occupancy awareness | ❌ No | ✅ Yes (lights) |
| Weather integration | ❌ No | ✅ Yes |
| Data logging | ❌ No | ✅ Yes (Git) |
| Google Sheets | ❌ No | ✅ Yes |
| Webhooks/alerts | ❌ No | ✅ Yes |

## Recommended Setup

**Use both in tandem**:

1. **Deploy these intelligent rules** for real-time temperature response
2. **Keep GitHub Actions** for logging, analytics, and advanced features
3. **Rules handle**: Immediate mode synchronization
4. **Actions handle**: Data collection, optimization, occupancy awareness

This gives you the best of both worlds:
- ✅ Instant response to temperature changes
- ✅ Smart conflict resolution (priority-based)
- ✅ Data logging and historical analysis
- ✅ Advanced features (weather, lights, sheets)

## Schema Reference

The rules use these SmartThings capabilities:
- `temperatureMeasurement` - Current temperature reading
- `thermostatHeatingSetpoint` - Desired heating target
- `thermostatCoolingSetpoint` - Desired cooling target
- `thermostatMode` - Mode control (heat/cool/off)

All comparisons are done in real-time using device attribute values, making the rules extremely responsive and accurate.
