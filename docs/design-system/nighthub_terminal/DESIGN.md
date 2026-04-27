---
name: NightHub Terminal
colors:
  surface: '#131318'
  surface-dim: '#131318'
  surface-bright: '#39383e'
  surface-container-lowest: '#0e0e13'
  surface-container-low: '#1b1b20'
  surface-container: '#1f1f25'
  surface-container-high: '#2a292f'
  surface-container-highest: '#35343a'
  on-surface: '#e4e1e9'
  on-surface-variant: '#c7c4d7'
  inverse-surface: '#e4e1e9'
  inverse-on-surface: '#303036'
  outline: '#908fa0'
  outline-variant: '#464554'
  surface-tint: '#c0c1ff'
  primary: '#c0c1ff'
  on-primary: '#1000a9'
  primary-container: '#8083ff'
  on-primary-container: '#0d0096'
  inverse-primary: '#494bd6'
  secondary: '#5de6ff'
  on-secondary: '#00363e'
  secondary-container: '#00cbe6'
  on-secondary-container: '#00515d'
  tertiary: '#ffb783'
  on-tertiary: '#4f2500'
  tertiary-container: '#d97721'
  on-tertiary-container: '#452000'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#e1e0ff'
  primary-fixed-dim: '#c0c1ff'
  on-primary-fixed: '#07006c'
  on-primary-fixed-variant: '#2f2ebe'
  secondary-fixed: '#a2eeff'
  secondary-fixed-dim: '#2fd9f4'
  on-secondary-fixed: '#001f25'
  on-secondary-fixed-variant: '#004e5a'
  tertiary-fixed: '#ffdcc5'
  tertiary-fixed-dim: '#ffb783'
  on-tertiary-fixed: '#301400'
  on-tertiary-fixed-variant: '#703700'
  background: '#131318'
  on-background: '#e4e1e9'
  surface-variant: '#35343a'
typography:
  h1:
    fontFamily: Space Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  h2:
    fontFamily: Space Grotesk
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  h3:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.4'
  mono-code:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.1em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  gutter: 20px
  margin: 32px
---

## Brand & Style

This design system is built on a **Neo-Noir Terminal** aesthetic, merging the grit of cyberpunk nightscapes with the precision of a high-end command center. It is designed for developers, system architects, and technical power users who require high information density without sacrificing visual atmosphere.

The style is a hybrid of **Minimalism** and **Tactile Futurism**. It utilizes a strict grid-based layout to maintain functional clarity, while employing subtle glow effects and deep-space color palettes to evoke a sense of "living in the machine." The interface should feel like a premium hardware console—stable, authoritative, and perpetually "on."

Key visual principles:
- **Atmospheric Depth:** Using layered dark surfaces instead of flat blacks.
- **Controlled Radiance:** Glows are used sparingly as a functional status indicator rather than pure decoration.
- **Information First:** Every design element serves to prioritize data visibility and system status.

## Colors

The palette is anchored in ultra-dark neutrals to reduce eye strain during long-duration usage. 

- **Primary (Indigo):** Used for main action states, focus indicators, and primary navigation. It provides a sophisticated, modern alternative to traditional terminal greens.
- **Accent (Cyan):** Reserved for data visualization highlights, progress bars, and active terminal cursors.
- **Semantic Colors:** Warning and Success utilize high-saturation amber and emerald to ensure critical status changes are immediately visible against the dark background.
- **The Glow:** Border colors should be paired with a 1px solid stroke and a 2px-4px soft outer glow (0.15 opacity) using the border or primary color to simulate an emissive display.

## Typography

This design system uses a tri-font hierarchy to balance futuristic flair with extreme legibility.

1. **Space Grotesk:** Used for headlines. Its geometric quirks reinforce the technical "hub" aesthetic. Keep headings tight and bold.
2. **Inter:** The workhorse for all body copy and user input. It provides high readability for complex data descriptions.
3. **JetBrains Mono:** Used for labels, metadata, and actual terminal output. Small-caps formatting should be applied to labels to create a professional, tabulated look.

## Layout & Spacing

The design system utilizes a **Fixed 12-Column Grid** for main dashboard views, switching to fluid containers for content-heavy internal pages. 

- **The 4px Rule:** All spacing must be a multiple of 4px to ensure perfect alignment in the terminal grid.
- **Rhythm:** Use 16px (md) for standard component padding and 20px (gutter) between grid cards.
- **Density:** High information density is encouraged. Elements should be packed efficiently but separated by clear 1px borders to maintain structural integrity.

## Elevation & Depth

In a neo-noir environment, depth is created through **Tonal Layering** and **Luminescence** rather than traditional shadows.

- **Level 0 (Base):** Background (#0A0A0F) represents the void.
- **Level 1 (Cards/Panels):** Surface (#12121A) with a 1px Border (#1E1E2E).
- **Level 2 (Modals/Popovers):** Surface (#1A1A26) with a Primary (#6366F1) border and a 8px soft-spread glow.
- **Interactions:** When an element is hovered, the border brightness increases, and a subtle inner glow is applied to the primary edge. No blur is used on background layers to maintain the sharp, high-tech terminal feel.

## Shapes

The shape language is defined by **Precision Curves**. 

- **Radius:** A standard 12px radius is applied to all primary containers and cards, providing a "built-in hardware" look that softens the aggressive dark theme.
- **Input Fields:** Use 6px (sm) for input fields and buttons to give them a more technical, tool-like appearance compared to the larger layout containers.
- **Icons:** All icons must use the Lucide outline set with a consistent 1.5px stroke weight. Avoid filled icons unless indicating an active/toggled state.

## Components

- **Buttons:** Primary buttons feature a solid Indigo fill with white text. Ghost buttons use the Cyan accent border with a subtle 0.1s transition to a soft glow on hover.
- **Terminal Cards:** Must include a header bar with a Label-Caps title and a 1px bottom border. Internal padding should be 16px.
- **Input Fields:** Background should be slightly darker than the surface. Use JetBrains Mono for the input text. On focus, the border transitions to Cyan with a 2px outer glow.
- **Chips/Badges:** Small, pill-shaped components with a 1px stroke. Background color should be 10% opacity of the stroke color (e.g., Success green at 10% opacity).
- **Status Indicators:** Use a small circular "LED" pulse animation (0.5s duration) next to critical system metrics to indicate real-time data streaming.
- **Scrollbars:** Custom slim 4px scrollbars in Border (#1E1E2E) color with an Indigo thumb.