/**
 * HVAC Loop Control Logic
 *
 * Manages two HVAC loops to ensure optimal temperature control:
 * - Loop 1 (Front): Hall, Primary Bedroom, NB's Office, Den
 * - Loop 2 (Back): Apartment, JR Office, Kitchen, Kids Bedroom
 *
 * Each loop can only be in one mode at a time (heat or cool).
 * All units on a loop must either be off or aligned with the loop mode.
 */

// Loop configuration
const LOOPS = {
  1: {
    name: 'Front Loop',
    zones: ['Front Hall', 'Primary Bedroom', 'NBs Office', 'Denn']
  },
  2: {
    name: 'Back Loop',
    zones: ['Basement', 'Jrs Office', 'Main Kitchen', 'Kids Bedroom']
  }
};

// Device ID mapping (matches poll-thermostat.js)
const ZONE_TO_DEVICE = {
  'NBs Office': '8021826e-78ca-4f3d-bd33-bdac1cadd3f2',
  'Basement': '8051fd90-ab24-467c-8746-3dadbce02252',
  'Denn': '87f9fbe2-f6b7-4877-9486-01b896a0acb5',
  'Front Hall': '999d0c8c-2caa-4ea6-a7ef-f8d73d1a5147',
  'Jrs Office': 'c44c9f12-1029-43c0-af5f-a5ff572d37c7',
  'Kids Bedroom': '8f5a0b61-76de-4add-bcb7-9cb5e7e8d3bd',
  'Main Kitchen': 'dd6b54be-a667-4acc-a112-d89c9923c29d',
  'Primary Bedroom': '9ced4ff7-4376-47c8-b882-5724bfb14306'
};

/**
 * Analyze a single zone's state
 * @param {Object} reading - Zone reading with temperature and thermostat data
 * @returns {Object} Analysis of the zone's state
 */
function analyzeZone(reading) {
  const { temperature, heatingSetpoint, coolingSetpoint, mode, operatingState } = reading;

  if (!temperature || mode === 'off') {
    return {
      active: false,
      wantsHeat: false,
      wantsCool: false,
      delta: 0,
      satisfied: true
    };
  }

  let wantsHeat = false;
  let wantsCool = false;
  let targetTemp = null;
  let delta = 0;

  // Determine what the zone wants based on mode and current temp
  if (mode === 'heat' && heatingSetpoint) {
    targetTemp = heatingSetpoint;
    delta = targetTemp - temperature.value;

    // Zone wants heat if current temp is below setpoint
    if (temperature.value < heatingSetpoint - 1) {
      wantsHeat = true;
    }
    // Zone is trying to heat beyond target (shouldn't happen but we check)
    else if (temperature.value > heatingSetpoint + 2) {
      // Overheated - should turn off or switch to cool
      wantsCool = true;
    }
  } else if (mode === 'cool' && coolingSetpoint) {
    targetTemp = coolingSetpoint;
    delta = temperature.value - targetTemp;

    // Zone wants cool if current temp is above setpoint
    if (temperature.value > coolingSetpoint + 1) {
      wantsCool = true;
    }
    // Zone is trying to cool beyond target (shouldn't happen but we check)
    else if (temperature.value < coolingSetpoint - 2) {
      // Overcooled - should turn off or switch to heat
      wantsHeat = true;
    }
  } else if (mode === 'auto') {
    // In auto mode, check both setpoints
    if (heatingSetpoint && temperature.value < heatingSetpoint - 1) {
      wantsHeat = true;
      targetTemp = heatingSetpoint;
      delta = targetTemp - temperature.value;
    } else if (coolingSetpoint && temperature.value > coolingSetpoint + 1) {
      wantsCool = true;
      targetTemp = coolingSetpoint;
      delta = temperature.value - targetTemp;
    }
  }

  const satisfied = !wantsHeat && !wantsCool;

  return {
    active: mode !== 'off',
    wantsHeat,
    wantsCool,
    delta: Math.abs(delta),
    targetTemp,
    currentTemp: temperature.value,
    mode,
    operatingState,
    satisfied
  };
}

/**
 * Determine the optimal mode for a loop based on all zones' needs
 * @param {Array} zoneAnalyses - Array of zone analysis objects
 * @returns {Object} Recommended loop mode and priority
 */
function determineLoopMode(zoneAnalyses) {
  const activeZones = zoneAnalyses.filter(z => z.active);

  if (activeZones.length === 0) {
    return {
      recommendedMode: 'off',
      priority: 'none',
      reason: 'All zones are off',
      maxDelta: 0
    };
  }

  // Calculate total demand for heat vs cool, weighted by delta
  let heatDemand = 0;
  let coolDemand = 0;
  let maxHeatDelta = 0;
  let maxCoolDelta = 0;
  let heatZones = [];
  let coolZones = [];

  activeZones.forEach(zone => {
    if (zone.wantsHeat) {
      heatDemand += zone.delta;
      heatZones.push(zone);
      if (zone.delta > maxHeatDelta) {
        maxHeatDelta = zone.delta;
      }
    }
    if (zone.wantsCool) {
      coolDemand += zone.delta;
      coolZones.push(zone);
      if (zone.delta > maxCoolDelta) {
        maxCoolDelta = zone.delta;
      }
    }
  });

  // Determine priority
  let recommendedMode;
  let priority;
  let reason;
  let maxDelta;

  if (heatDemand === 0 && coolDemand === 0) {
    // All zones are satisfied
    recommendedMode = activeZones[0]?.mode || 'heat';
    priority = 'low';
    reason = 'All zones are at target temperature';
    maxDelta = 0;
  } else if (heatDemand > 0 && coolDemand === 0) {
    // Only heating needed
    recommendedMode = 'heat';
    priority = maxHeatDelta > 3 ? 'high' : 'normal';
    reason = `${heatZones.length} zone(s) need heating`;
    maxDelta = maxHeatDelta;
  } else if (coolDemand > 0 && heatDemand === 0) {
    // Only cooling needed
    recommendedMode = 'cool';
    priority = maxCoolDelta > 3 ? 'high' : 'normal';
    reason = `${coolZones.length} zone(s) need cooling`;
    maxDelta = maxCoolDelta;
  } else {
    // Conflicting needs - prioritize based on total demand and max delta
    // Give extra weight to zones with large deltas (>3 degrees)
    const weightedHeatDemand = heatDemand + (maxHeatDelta > 3 ? maxHeatDelta * 2 : 0);
    const weightedCoolDemand = coolDemand + (maxCoolDelta > 3 ? maxCoolDelta * 2 : 0);

    if (weightedHeatDemand > weightedCoolDemand) {
      recommendedMode = 'heat';
      priority = 'high';
      reason = `Conflict: ${heatZones.length} zone(s) need heat (Δ=${maxHeatDelta.toFixed(1)}°), ${coolZones.length} need cool (Δ=${maxCoolDelta.toFixed(1)}°) - prioritizing heat`;
      maxDelta = maxHeatDelta;
    } else {
      recommendedMode = 'cool';
      priority = 'high';
      reason = `Conflict: ${coolZones.length} zone(s) need cool (Δ=${maxCoolDelta.toFixed(1)}°), ${heatZones.length} need heat (Δ=${maxHeatDelta.toFixed(1)}°) - prioritizing cool`;
      maxDelta = maxCoolDelta;
    }
  }

  return {
    recommendedMode,
    priority,
    reason,
    maxDelta,
    heatDemand,
    coolDemand,
    heatZones: heatZones.length,
    coolZones: coolZones.length
  };
}

/**
 * Generate actions to bring a loop into compliance
 * @param {number} loopId - Loop ID (1 or 2)
 * @param {Object} devicesData - Map of device data by location name
 * @returns {Object} Actions to take
 */
function analyzeLoop(loopId, devicesData) {
  const loop = LOOPS[loopId];
  if (!loop) {
    throw new Error(`Invalid loop ID: ${loopId}`);
  }

  // Gather zone analyses
  const zoneAnalyses = loop.zones.map(zoneName => {
    const deviceData = devicesData[zoneName];
    if (!deviceData) {
      console.warn(`No data for zone: ${zoneName}`);
      return {
        zoneName,
        active: false,
        wantsHeat: false,
        wantsCool: false,
        delta: 0,
        satisfied: true,
        missing: true
      };
    }

    return {
      zoneName,
      deviceId: ZONE_TO_DEVICE[zoneName],
      ...analyzeZone(deviceData),
      ...deviceData
    };
  });

  // Determine optimal loop mode
  const loopDecision = determineLoopMode(zoneAnalyses);

  // Generate actions for each zone
  const actions = [];

  zoneAnalyses.forEach(zone => {
    if (zone.missing) return;

    // Check if zone needs adjustment
    const shouldBeOff = !zone.active ||
                       (zone.mode !== 'off' && zone.mode !== loopDecision.recommendedMode && zone.mode !== 'auto');

    // If zone is on but in wrong mode for the loop, we need to either:
    // 1. Turn it off if it's satisfied
    // 2. Switch it to the correct mode if it needs conditioning
    if (zone.mode !== 'off' && zone.mode !== loopDecision.recommendedMode && loopDecision.recommendedMode !== 'off') {
      if (zone.satisfied) {
        // Zone is satisfied but in wrong mode - turn it off
        actions.push({
          zoneName: zone.zoneName,
          deviceId: zone.deviceId,
          action: 'set_mode',
          currentMode: zone.mode,
          newMode: 'off',
          reason: `Zone satisfied and conflicts with loop mode (${loopDecision.recommendedMode})`,
          priority: 'normal'
        });
      } else {
        // Zone needs conditioning but is in wrong mode
        // Check if it wants what the loop can provide
        if ((loopDecision.recommendedMode === 'heat' && zone.wantsHeat) ||
            (loopDecision.recommendedMode === 'cool' && zone.wantsCool)) {
          // Switch to loop mode
          actions.push({
            zoneName: zone.zoneName,
            deviceId: zone.deviceId,
            action: 'set_mode',
            currentMode: zone.mode,
            newMode: loopDecision.recommendedMode,
            reason: `Aligning with loop mode to satisfy zone needs (Δ=${zone.delta.toFixed(1)}°)`,
            priority: zone.delta > 3 ? 'high' : 'normal'
          });
        } else {
          // Zone wants opposite of what loop provides - turn it off
          actions.push({
            zoneName: zone.zoneName,
            deviceId: zone.deviceId,
            action: 'set_mode',
            currentMode: zone.mode,
            newMode: 'off',
            reason: `Zone needs ${zone.wantsHeat ? 'heat' : 'cool'} but loop is in ${loopDecision.recommendedMode} mode`,
            priority: 'normal'
          });
        }
      }
    }

    // Check for zones heating/cooling beyond target
    if (zone.mode === 'heat' && zone.currentTemp > zone.targetTemp + 2) {
      actions.push({
        zoneName: zone.zoneName,
        deviceId: zone.deviceId,
        action: 'set_mode',
        currentMode: zone.mode,
        newMode: 'off',
        reason: `Overheated: ${zone.currentTemp.toFixed(1)}° exceeds target ${zone.targetTemp}° by ${(zone.currentTemp - zone.targetTemp).toFixed(1)}°`,
        priority: 'high'
      });
    } else if (zone.mode === 'cool' && zone.currentTemp < zone.targetTemp - 2) {
      actions.push({
        zoneName: zone.zoneName,
        deviceId: zone.deviceId,
        action: 'set_mode',
        currentMode: zone.mode,
        newMode: 'off',
        reason: `Overcooled: ${zone.currentTemp.toFixed(1)}° below target ${zone.targetTemp}° by ${(zone.targetTemp - zone.currentTemp).toFixed(1)}°`,
        priority: 'high'
      });
    }
  });

  return {
    loopId,
    loopName: loop.name,
    zones: zoneAnalyses,
    decision: loopDecision,
    actions,
    timestamp: new Date().toISOString()
  };
}

/**
 * Analyze all loops and generate recommended actions
 * @param {Object} allDevicesData - Map of all device data keyed by location name
 * @returns {Object} Complete analysis of both loops
 */
function analyzeAllLoops(allDevicesData) {
  const loop1Analysis = analyzeLoop(1, allDevicesData);
  const loop2Analysis = analyzeLoop(2, allDevicesData);

  // Prioritize actions across both loops
  const allActions = [
    ...loop1Analysis.actions.map(a => ({ ...a, loop: 1 })),
    ...loop2Analysis.actions.map(a => ({ ...a, loop: 2 }))
  ];

  // Sort by priority (high first, then normal, then low)
  const priorityOrder = { high: 0, normal: 1, low: 2 };
  allActions.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    timestamp: new Date().toISOString(),
    loop1: loop1Analysis,
    loop2: loop2Analysis,
    allActions,
    summary: {
      totalActions: allActions.length,
      highPriority: allActions.filter(a => a.priority === 'high').length,
      loop1Mode: loop1Analysis.decision.recommendedMode,
      loop2Mode: loop2Analysis.decision.recommendedMode
    }
  };
}

module.exports = {
  analyzeLoop,
  analyzeAllLoops,
  analyzeZone,
  determineLoopMode,
  LOOPS,
  ZONE_TO_DEVICE
};
