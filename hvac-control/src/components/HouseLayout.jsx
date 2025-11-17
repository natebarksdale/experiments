import { motion } from 'framer-motion';
import ZoneCard from './ZoneCard';
import './HouseLayout.css';

const FLOOR_NAMES = {
  3: '3rd Floor',
  2: '2nd Floor',
  1: '1st Floor',
  0: 'Basement',
};

export default function HouseLayout({ zones, onZoneClick }) {
  // Group zones by floor
  const zonesByFloor = zones.reduce((acc, zone) => {
    if (!acc[zone.floor]) acc[zone.floor] = [];
    acc[zone.floor].push(zone);
    return acc;
  }, {});

  // Sort floors from top to bottom
  const floors = Object.keys(zonesByFloor)
    .map(Number)
    .sort((a, b) => b - a);

  return (
    <div className="house-layout">
      {floors.map((floorNum, floorIndex) => {
        const floorZones = zonesByFloor[floorNum].sort((a, b) => {
          // Sort south to north
          const order = { south: 0, center: 1, north: 2 };
          return order[a.position] - order[b.position];
        });

        return (
          <motion.section
            key={floorNum}
            className="floor-section"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: floorIndex * 0.1 }}
          >
            <h2 className="floor-title">{FLOOR_NAMES[floorNum]}</h2>

            <div className="floor-zones">
              {floorZones.map((zone, zoneIndex) => (
                <motion.div
                  key={zone.id}
                  className="zone-wrapper"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: floorIndex * 0.1 + zoneIndex * 0.05 }}
                >
                  <ZoneCard
                    zone={zone}
                    onClick={() => onZoneClick && onZoneClick(zone)}
                  />
                </motion.div>
              ))}
            </div>
          </motion.section>
        );
      })}
    </div>
  );
}
