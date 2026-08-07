# DESIGN-GRAPHS — Section Marchés NightHub

Date : 07/08/2026. État : implémentation déjà faite (commits 2cce46d, 61f3718, 72f0768) ; ce doc formalise les directions et la reco.

## 3 directions nommées

1. **TERMINAL DRAW** (recommandée — déjà implémentée)
   - Courbe SVG qui se trace gauche→droite (stroke-dashoffset + getTotalLength réel, 1.1s cubic-bezier(0.22,1,0.36,1))
   - Points ronds HTML absolus (non étirés par preserveAspectRatio=none), apparition en cascade (0.05s/point)
   - Zone colorée sous la courbe (dégradé 0.3 → 0), grille 3 lignes, prix aux extrémités (1er gauche / dernier droite)
   - Tooltip prix au survol + marqueur vertical pointillé ; réduit par prefers-reduced-motion
   - Sources d'inspiration : r/dataisbeautiful (sparklines minimalistes), Dribbble "crypto terminal dark"

2. **GLOW TRACE**
   - Même tracé progressif + lueur pulsante sur le dernier point (drop-shadow), épaisseur de trait 2.5
   - Plus spectaculaire, plus coûteux visuellement ; réservé au graph détaillé, pas aux mini

3. **STEP CANDLE**
   - Rendue en chandeliers/barres mini (scaleY grow en cascade, delays 120ms) type trading terminal
   - Idéal si on veut une lecture OHLC ; plus dense, moins lisible en 100×32

## Reco
**Terminal Draw** — cohérent avec l'identité dark terminal (JetBrains Mono, Space Grotesk), lisible, performant (SVG + CSS, zéro lib).

## Specs techniques
- Couleurs : positif #22c55e / négatif #ef4444 ; grille #1E1E2E ; labels #94a3b8
- Typo labels : JetBrains Mono 9px ; prix extrémités 9px avec fond rgba(10,10,14,.85)
- Mini sparklines GRID/LIST : 100×32, même animation (getTotalLength calculé au 1er rendu + au toggle)
- Graph détail : 200×64, grille 3 lignes, marqueur survol 0.75px dashed #64748b, tooltip #1E1E2E bord #2A2A3E
- Animations : draw 1.1s, points 0.25s cascade, reveal bloc 0.35s fadeInUp — tout coupé par prefers-reduced-motion
- Données : sparkline7d déjà fourni par Binance (klines 8j) et Yahoo

## Reste à faire
- [ ] Valider rendu final sur 4201 (points alignés sur la courbe, prix extrémités)
- [ ] (Optionnel) direction GLOW TRACE sur le graph détaillé si l'user veut plus de style
