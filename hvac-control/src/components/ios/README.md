# iOS Prototype - Apple HIG Design

This directory contains a parallel iOS-styled implementation of the HVAC Control app, following Apple's Human Interface Guidelines.

## Features

- **100% Functional Parity**: All features from the original Tufte design are preserved
- **Apple HIG Aesthetic**: iOS Control Center / Home app inspired design
- **SF Pro Display**: Apple's system font family
- **iOS Semantic Colors**: Standard iOS color palette (blues, oranges, teals)
- **Frosted Glass Cards**: Backdrop blur effects with subtle shadows
- **Spring Physics**: Framer Motion animations with natural feel
- **8pt Grid System**: Consistent spacing following Apple's guidelines
- **Sheet Modals**: iOS-style bottom sheet presentations
- **Segmented Controls**: Native iOS control patterns
- **Toggle Switches**: iOS-standard switches with animations

## Components

- **IOSApp.jsx** - Main app shell with header, tabs, and auth
- **IOSDashboard.jsx** - Floor-grouped card layout
- **IOSZoneCard.jsx** - Individual zone cards with HVAC/accessory status
- **IOSZoneModal.jsx** - Full-screen detail view for zone control
- **IOSHistory.jsx** - Timeline view of activity logs

## Usage

Access the iOS prototype by:

1. **URL Parameter**: Add `?design=ios` to the URL
2. **Toggle Button**: Click the floating button in the bottom-right corner
3. **Direct Navigation**: The preference is saved to localStorage

## Design Decisions

### Color Coding
- **Orange**: Heating mode
- **Teal**: Cooling mode
- **Yellow**: Active lights/accessories
- **Gray**: Off/inactive state
- **Blue**: System actions and links

### Layout
- Cards instead of rows for better touch targets
- Floor-based grouping for spatial organization
- Staggered entrance animations for polish
- Responsive grid that adapts to screen size

### Interactions
- Hover effects for desktop
- Active (press) states for all buttons
- Spring physics for natural motion
- Bottom sheet modals for iOS familiarity
- Direct toggle for single-control zones (no modal)

## Files Structure

```
ios/
├── IOSApp.jsx          # Main app shell
├── IOSApp.css          # App layout + design system
├── IOSDashboard.jsx    # Floor-grouped dashboard
├── IOSDashboard.css    # Grid layout + animations
├── IOSZoneCard.jsx     # Individual zone cards
├── IOSZoneCard.css     # Card styling + accents
├── IOSZoneModal.jsx    # Zone detail modal
├── IOSZoneModal.css    # Modal + controls
├── IOSHistory.jsx      # Activity timeline
├── IOSHistory.css      # Timeline styling
└── README.md           # This file
```

## Notes

- The original Tufte design remains fully intact in `/src/components/`
- Both designs share the same backend services and state management
- Switch between designs at any time without losing data or state
- Sparklines were intentionally omitted from this design as they didn't fit the iOS aesthetic
