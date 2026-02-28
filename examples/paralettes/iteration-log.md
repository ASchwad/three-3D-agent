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

---

## Iteration 6 — Deep Comparison & Geometry Rewrite (ExtrudeGeometry)

**Root cause analysis of remaining gap**: Detailed side-by-side comparison of current model (iteration 5) screenshots vs reference images from all three angles revealed the FUNDAMENTAL problem:

| View | Reference | Iteration 5 | Issue |
|---|---|---|---|
| Front | Wide flat bars, thick solid frame | Narrow round tubes, thin wireframe | Cross-section is WRONG — reference uses flat plate/strap, model used round tubes |
| Side | Thick slab profile with substantial depth | Thin vertical bar, barely visible | Depth too shallow (8mm), bars have no flat visible area from side |
| Three-quarter | Flat faces clearly visible on legs | Round cylinders, no flat faces | Entire structural vocabulary wrong |

**Critical insight**: The CSG-of-RoundedBoxes approach was producing near-circular cross-sections (T=5.5, depth=8, cornerR=2.64 ≈ T/2). This made every bar look like a round tube. The reference model is a flat extruded plate.

**Changes (Iteration 6a–6d)**:
1. **Switched from CSG to ExtrudeGeometry** — Built the 2D front-view profile as a THREE.Shape:
   - Outer boundary: rounded triangle (computed via `buildRoundedTrianglePath` with fillet arcs at each vertex)
   - Inner hole: offset inward by T (computed via edge-line intersection math)
   - Grip hole: circle at apex center
   - Extruded along Z with bevel for edge rounding
2. **Fixed arc direction bug** — `buildRoundedTrianglePath` was computing arcs in wrong direction (CW instead of CCW for outer contour). Fixed by normalizing `angleDiff` to positive range.
3. **Fixed inner triangle vertex calculation** — Replaced ad-hoc formulas with proper `lineLineIntersect()` helper using edge offset + intersection math.
4. **Reduced bevel ratio** — From 0.35 to 0.12 (later 0.20) of min(T, depth) to prevent excessive edge rounding that made flat plates look like tubes.
5. **Updated proportions** — barThickness: 5.5→8, depth: 8→16, triangleHeight: 50→62

**Result**: Frame now reads as a flat extruded plate from all angles. Side view shows thick 16mm slab. Perspective shows flat faces on legs.

**Screenshots**: `paralette-iter6d-front.png`, `paralette-iter6d-right.png`, `paralette-iter6d-perspective.png`

---

## Iteration 7 — Proportional Refinement

**Changes**:
1. **Increased gripOuterR** — Formula changed from `gripDia/2 + T*0.55` to `gripDia/2 + T*0.75`. Gives outer diameter ≈ 2.5x T, matching reference proportions.
2. **Increased gripDiameter** — Default 6→8mm for more visible through-hole
3. **Increased bevel** — 0.12→0.20 of min(T, depth) for softer edges matching reference
4. **Increased feet** — footRadius 3.5→5, footHeight 2→3 for more prominent base bumps
5. **Improved grip tube** — Added rounded end-caps to LatheGeometry profile, reduced outer radius by 0.02 to avoid z-fighting with frame within depth

**Params**: baseWidth=55, triangleHeight=62, T=8, depth=16, gripDia=8, gripExt=5, footR=5, footH=3
**Computed**: gripOuterR=10, bevelR=1.6, outerApexR=gripOuterR=10

**Screenshots**: `paralette-iter7-front.png`, `paralette-iter7-right.png`, `paralette-iter7-perspective.png`

**Assessment vs reference**:

| Feature | Reference | Iteration 7 | Match? |
|---|---|---|---|
| Flat plate construction | Wide flat bars | Yes — ExtrudeGeometry creates flat plate | GOOD |
| Inner triangle void | Large, clear | Clear and proportional | GOOD |
| Grip ring integrated | Smooth flow from legs to ring | Fillet arc at apex = grip ring | GOOD |
| Grip hole visible | Clear through-hole | Yes, 8mm diameter | GOOD |
| Edge rounding | Soft, organic edges | Moderate bevel (1.6mm) | OK |
| Side view: thick slab | Substantial depth | 16mm depth, clear flat faces | GOOD |
| Perspective: flat faces | Clearly extruded | Yes, flat faces visible | GOOD |
| Foot bumps at base | Prominent rounded bumps | Capsule feet, visible but smaller | PARTIAL |
| Base bar width | Similar to legs | Same T as legs | OK |
| Overall proportions | ~80% W:H ratio | 55:62 = 89% (79% with grip) | GOOD |

**Major improvements over iterations 1–5**:
- Geometry approach changed from CSG-of-rounded-boxes (tube look) to ExtrudeGeometry (flat plate look)
- Frame reads as an extruded 2D profile from all angles
- Grip ring is part of the 2D profile (apex fillet), not a separate CSG cap
- Side view shows substantial 16mm depth slab instead of thin 8mm bar

**Remaining minor issues**:
1. Feet are separate capsule meshes, not fully integrated into base bar profile
2. Grip tube extensions beyond frame depth are still separate LatheGeometry mesh (minor visual seam possible)
3. Base bar corners in reference have more prominent bulging feet than current capsules

---

## Iteration 8 — Integrate Feet into Frame Profile

**Root cause analysis**: The separate CapsuleGeometry feet don't match the reference where feet are seamlessly part of the frame outline. The feet need to be part of the 2D extruded profile.

**Changes**:
1. **Generalized `buildRoundedTrianglePath` → `buildRoundedPolygonPath`** — Now accepts an array of `{x, y, r}` vertices instead of fixed 3-vertex signature. Works for any N-vertex convex polygon with per-vertex fillet radii.
2. **5-vertex outer contour with integrated feet** — Replaced 3-vertex triangle with 5 vertices:
   - Left foot: extends below base corner along leg line + lateral spread (`footWidthExtra = footR * 0.5`)
   - Left base return: where base returns to normal height (r=0, sharp corner softened by bevel)
   - Right base return: symmetric
   - Right foot: symmetric
   - Apex: same as before (fillet r = gripOuterR)
3. **Removed separate foot parts** — Deleted CapsuleGeometry foot meshes, `foot-left`/`foot-right` part types, and foot JSX rendering
4. **Updated default params** — gripDiameter: 8→12, footRadius: 5→7, footHeight: 3→5
5. **Added lateral foot spread** — `footWidthExtra = footR * 0.5` makes feet extend wider than the base corners for stability

**Params**: baseWidth=55, triangleHeight=62, T=8, depth=16, gripDia=12, gripExt=5, footR=7, footH=5
**Computed**: gripOuterR=12, bevelR=1.6, returnOffset=footR*2.5=17.5

**Screenshots**: `paralette-iter8b-front.png`, `paralette-iter8b-right.png`, `paralette-iter8b-perspective.png`

**Assessment vs reference**:

| Feature | Reference | Iteration 8 | Match? |
|---|---|---|---|
| Feet integrated into frame | Part of frame outline | Yes — 5-vertex polygon with foot bumps | GOOD |
| Foot prominence | Large, wide bumps | Rounded bumps with lateral spread | GOOD |
| Base valley between feet | Concave bottom profile | Yes — base returns higher than feet | GOOD |
| Grip ring integrated | Smooth flow from legs | Apex fillet = grip ring | GOOD |
| Grip hole size | ~50-60% of ring OD | 12mm/24mm = 50% | GOOD |
| Flat plate construction | Wide flat bars | ExtrudeGeometry with 16mm depth | GOOD |
| Side view: thick slab | Substantial depth | 16mm depth, clear flat faces | GOOD |
| Inner triangle opening | Large, clear | Clear and proportional | GOOD |
| A-frame proportions | ~0.85 W:H | 55:62 = 0.89 | GOOD |

**Major improvements over iteration 7**:
- Feet are now seamlessly integrated into the frame's 2D profile (no separate meshes)
- Base has a natural valley shape between the feet matching the reference
- Grip hole is larger (12mm vs 8mm) — closer to reference proportions
- Feet extend laterally for a wider, more stable stance
- Part count reduced from 4 (frame, grip, foot-left, foot-right) to 2 (frame, grip)

**Remaining minor issues**:
1. Grip tube extensions beyond frame depth are still a separate LatheGeometry mesh (minor visual seam possible at depth boundary)
2. Concave vertices at base return points have r=0 (sharp corners), softened only by extrusion bevel — could benefit from small concave fillets for smoother transition

---

## Iteration 8b — Remove Grip Tube (Single-Mesh Attempt)

**Changes**: Removed the separate LatheGeometry grip tube entirely. The grip bore was punched directly through the frame as a shape hole at `gripInnerR`. All geometry was a single ExtrudeGeometry mesh.

**Problems**: While the front view looked clean (single continuous disc), the side view showed a flat rectangular plate with NO 3D barrel visible. The reference side view clearly shows a cylindrical barrel extending well beyond the frame depth. The single-mesh approach can't produce a cylindrical barrel shape since ExtrudeGeometry has uniform depth everywhere.

---

## Iteration 9 — Re-add Grip Barrel with Proper Proportions

**Root cause analysis**: The grip barrel MUST be a separate mesh (LatheGeometry) to achieve the cylindrical 3D shape visible from the side. The key is proper proportions and embedding the tube into the frame's apex hole for a seamless look.

**Changes**:
1. **Re-added LatheGeometry grip tube** — Separate mesh at apex, revolved tube profile with barrel-shaped cross-section (large outer bevels for smooth barrel caps)
2. **Frame grip hole at `gripOuterR`** — The frame's 2D profile has a circular hole matching the tube's outer radius, so the tube fills the hole cleanly
3. **Larger proportions** — `gripOuterR = gripDia/2 + T*0.8 = 12.4mm` (barrel OD = 24.8mm), `apexFilletR = gripOuterR + T*0.4 = 15.6mm` (disc OD = 31.2mm)
4. **Barrel-shaped LatheGeometry profile** — Large outer bevel radius (`wallThick * 0.45`) for smooth rounded barrel caps matching reference's organic barrel shape
5. **Updated defaults** — gripExtension: 5→8 for more prominent barrel from side view

**Params**: baseWidth=55, triangleHeight=62, T=8, depth=16, gripDia=12, gripExt=8, footR=7, footH=5
**Computed**: gripInnerR=6, gripOuterR=12.4, apexFilletR=15.6, bevelR=1.6, totalTubeLen=32

**Screenshots**: `paralette-iter9c-front.png`, `paralette-iter9c-right.png`, `paralette-iter9c-perspective.png`

**Assessment vs reference**:

| Feature | Reference | Iteration 9 | Match? |
|---|---|---|---|
| 3D barrel at apex | Cylindrical barrel visible from side | Yes — LatheGeometry tube extends 8mm each side | GOOD |
| Barrel shape | Smooth rounded ends | Barrel-shaped profile with large bevel caps | GOOD |
| Front disc ring | Large disc with bore | Frame disc ring (apexFilletR) + tube face = disc | GOOD |
| Barrel proportions | Barrel OD ≈ 1.5–2x frame depth | 24.8mm OD / 16mm depth = 1.55x | GOOD |
| Frame flat plate | Wide flat bars | ExtrudeGeometry, 16mm depth | GOOD |
| Integrated feet | Part of frame outline | 5-vertex polygon with foot bumps | GOOD |
| Bore visible | Clear through-hole | 12mm diameter bore through tube | GOOD |
| Leg-to-disc junction | Smooth flow | Slight pinch where legs meet disc fillet | PARTIAL |

**Major improvements over iteration 8/8b**:
- 3D barrel is back and properly proportioned (not too big, not too small)
- Barrel extends beyond frame depth on both sides (visible from side view)
- Barrel has smooth rounded caps (not sharp rectangular ends)
- Frame ring around barrel is proportional (3.2mm ring width)

**Remaining minor issues**:
1. Slight pinch/neck where the frame legs converge to the apex disc — the fillet transition could be smoother
2. The junction between frame and barrel at the apex has a visible step (two separate meshes meeting)
