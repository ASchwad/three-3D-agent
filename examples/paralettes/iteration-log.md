# Paralette 3D Model — Iteration Log

## Reference Target

The target is an A-shaped triangular fitness frame with:
- Rounded tubular bars (not flat slabs)
- A grip ring at the apex smoothly integrated into the converging legs
- A circular through-hole in the grip ring
- A grip bar (cylinder) extending from the ring along Z
- Rounded capsule feet at the bottom corners

Reference images: `front-view.png`, `three-quarter-view.png`, `side-view.png`

Key observations from references:
- **Front**: Legs flow smoothly into the grip ring — no visible seam. Inner triangular opening is large. Ring outer diameter ≈ 2x bar thickness. Hole diameter ≈ bar thickness.
- **Three-quarter**: Grip bar extends moderately from the ring. Bars have substantial depth. The grip bar diameter ≈ frame depth.
- **Side**: Bars look like rounded tubes. Grip is a compact rounded knob at the apex.

---

## Iteration 1 — Initial CSG Implementation

**Approach**: Replaced the old `ExtrudeGeometry` 2D extrusion with CSG union of `RoundedBoxGeometry` bars + apex cylinder + grip hole subtraction. Separate `LatheGeometry` grip tube at the same position.

**Params**: baseWidth=4.2, triangleHeight=7.0, depth=1.4, gripDia=0.7, gripExt=0.6

**Code**: CSG frame = base bar + left leg + right leg + apex cap (CylinderGeo, r=gripOuterR, h=depth) - grip hole (CylinderGeo). Plus separate LatheGeometry grip tube (full length depth+2*gripExt) at apex.

**Screenshot**: (user's photo — shows massive cylinder on top)

**Problems identified**:
1. **CRITICAL: Massive grip cylinder** — CSG apex cap AND LatheGeometry grip tube overlap at the same position, creating a huge double-layered cylinder on top of the frame
2. **Base bar color mismatch** — CSG material groups cause different shading on base vs legs
3. **Proportions too tall/narrow** — triangleHeight=7.0 vs baseWidth=4.2 gives steep A-frame

**Root cause**: Two overlapping geometries at the apex — the CSG solid cap + the LatheGeometry hollow tube. They don't merge (different meshes), creating the appearance of a thick log sitting on the frame.

---

## Iteration 2 — Remove CSG Apex Cap

**Changes**:
- Removed apex cap and grip hole subtraction from CSG frame
- Frame = base bar + left leg + right leg only (no apex geometry)
- Grip tube remains as LatheGeometry (now the ONLY geometry at apex)
- Cleared CSG material groups (`finalGeo.groups.length = 0`)
- Extended legs past apex (`legExt = gripOuterR * 0.6`) to overlap inside grip tube
- Updated default params: baseWidth=5.2, triangleHeight=5.8, footRadius=0.35

**Computed values**: gripOuterR = 0.625 (formula: gripDia/2 + T*0.5, with depth/2 term removed)

**Problems identified**:
1. **Grip still too large** — gripOuterR=0.625 gives outer diameter 1.25, still dominant
2. **Bars still look flat** — cornerR=0.22, segments=4 gives minimal rounding
3. **Depth too large** — depth=1.4 with T=0.55 gives 2.5:1 aspect ratio cross-section (slab-like)
4. **Triangle still too tall** — 5.8 height vs 5.2 width

---

## Iteration 3 — Fix Proportions & Corner Rounding

**Changes**:
- gripOuterR formula: `gripDia/2 + T*0.35` (reduced from T*0.5)
- cornerR: `T * 0.48` (increased from T*0.4, near-max for tube-like bars)
- segments: 6 (increased from 4 for smoother rounding)
- Default params: depth=1.0, gripDia=0.5, gripExt=0.4, baseWidth=5.5, triangleHeight=5.0

**Problems identified**:
- Still iterating on proportions
- User began manual tweaking of parameters

---

## Iteration 4 — User Parameter Tweaks (Current State)

**User manually adjusted** params in both files:
- `depth: 0.6` (shallow for near-square bar cross-section)
- `gripDiameter: 0.8` (larger hole)
- `gripExtension: 0.35`
- `footRadius: 0.18, footHeight: 0.12` (smaller feet)
- `gripOuterR = gripDia/2 + T*0.4` (wall = 0.22)
- `legExt = gripOuterR * 0.9` (more leg extension into grip tube)

**Computed values**:
- gripInnerR = 0.4, gripOuterR = 0.62
- cornerR = 0.264 (T * 0.48)
- Bar cross-section: 0.55 x 0.6 (nearly square — good for tube look)

**Screenshots**: `paralette-iter4-default.png`, `paralette-iter4-front.png`, `paralette-iter4-side.png`

**Assessment vs reference**:

| Feature | Reference | Iteration 4 | Match? |
|---|---|---|---|
| Bar tube-like cross-section | Clearly rounded | Nearly-square, good rounding | OK |
| Inner triangle opening | Large, clear | Visible and clear | OK |
| Feet at bottom | Small rounded bumps | Small capsules | OK |
| A-frame proportions | ~1:1 W:H | 5.5:5.0 | OK |
| Grip ring integrated into frame | Smooth transition from legs to ring | Grip is SEPARATE mesh on top of legs | FAIL |
| Front view: ring with hole | Ring is part of frame outline | Ring is separate LatheGeometry tube | PARTIAL |
| Grip bar extension | Moderate, proportional | Slightly large but acceptable | OK |
| Frame depth | Substantial (~1.0-1.2 estimated) | Shallow (0.6) | THIN |

**Remaining critical issue**: The grip ring is NOT integrated into the frame. In the reference, the legs smoothly merge into the ring — it's all one continuous surface. In the current model, the grip tube is a separate mesh that sits on top of the frame legs. This creates a visible seam and the ring doesn't flow from the legs.

---

## Iteration 5 — Re-integrate Grip Ring into CSG Frame

**Root cause analysis**: The grip ring must be part of the same mesh as the frame for the integrated look. The legs need to flow into the ring, not terminate below it.

**Changes**:
1. Added apex cylinder BACK into CSG frame (height = frame depth + 0.01)
2. Added grip hole subtraction back into CSG frame
3. Grip tube outer radius reduced by 0.005 to hide behind CSG frame within depth
4. Depth increased: 0.6 → 0.8 for more substantial bars
5. Re-imported `SUBTRACTION` from three-bvh-csg

**Params**: baseWidth=5.5, triangleHeight=5.0, T=0.55, depth=0.8, gripDia=0.8, gripExt=0.35

**Computed values**:
- gripInnerR = 0.4, gripOuterR = 0.62
- Grip tube outerR = 0.615 (hidden behind CSG frame within depth)
- Bar cross-section: 0.55 × 0.8 (1.45:1 ratio, decent tube-like shape)

**Screenshots**: `paralette-iter5-default.png`, `paralette-iter5-front.png`, `paralette-iter5-side.png`

**Assessment vs reference**:

| Feature | Reference | Iteration 5 | Match? |
|---|---|---|---|
| Grip ring integrated into frame | Legs flow smoothly into ring | YES — CSG union creates integrated ring | GOOD |
| Front view: ring with hole | Clear annulus with through-hole | YES — visible hole through ring | GOOD |
| Bar tube-like cross-section | Rounded tubes | Good rounding (cornerR=0.264) | OK |
| Inner triangle opening | Large, clear | Large and clearly visible | GOOD |
| Feet at bottom | Small rounded bumps | Small capsules at corners | OK |
| A-frame proportions | ~1:1 W:H | 5.5:5.0 (1.1:1) | GOOD |
| Grip bar extension | Moderate | gripExt=0.35 with depth=0.8 (44%) | OK |
| Frame depth | Substantial | depth=0.8 (better than 0.6) | IMPROVED |
| Base bar shading | Uniform color | Slightly different shade (CSG artifact?) | MINOR |

**Major improvement**: The grip ring is now integrated into the frame. From the front view, the ring with its hole is clearly part of the frame geometry. The legs converge into the ring area naturally through the CSG union.

**Remaining minor issues**:
1. Base bar may show slight shading difference (CSG normals artifact)
2. Grip ring is slightly wider than reference (~2.25x T vs ~1.7x T in reference) — parameter choice, not code issue
3. Could potentially benefit from slightly more depth (0.8 vs reference ~1.0)
