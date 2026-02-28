# Product Requirements Document — Three.js 3D Builder

**Date:** 2026-02-28
**Status:** Draft

---

## Feature 1: Reference Image Viewer

### Problem

Reference images used to design each 3D project live in the `examples/` directory and are only accessible on disk. Users cannot see them in the app, making it impossible to visually compare the 3D model against the original reference without switching to a file browser.

### Goal

Display the reference images for the active project directly in the frontend UI, so users can compare their parametric model to the original reference at a glance. The current Parameters Panel will be a general panel. Parameters will be one tab, Reference images should be a separate tab.

### Requirements

**P0 — Must have:**

- Each project in `projects.ts` gains an optional `referenceImages: string[]` field pointing to image paths (imported as static assets via Vite).
- A toggleable **"Reference" panel** in the UI (e.g. bottom-left overlay or collapsible sidebar section) that shows thumbnails of all reference images for the active project.
- Clicking a thumbnail opens a larger view (modal or expanded panel) for detailed comparison.
- When switching projects, the reference images update to match the new active project.
- Projects with no reference images simply don't show the panel.

**P1 — Should have:**

- A **side-by-side mode** that renders the reference image next to a screenshot of the current 3D viewport for direct comparison.
- Drag-and-drop upload: users can drop new reference images onto the panel, which get stored in memory (session-only) or saved to `examples/<project>/`.
- Opacity slider to overlay the reference image semi-transparently on top of the 3D canvas for alignment checks.

**P2 — Nice to have:**

- Pin a reference image as a texture plane inside the 3D scene (billboard at a fixed screen position) for in-context comparison.

### Technical Approach

- Import images statically at build time in `projects.ts` using Vite's `import.meta.glob` or explicit imports.
- New `ReferencePanel` component positioned as an absolute overlay (bottom-left, `z-10`), consistent with the existing panel pattern (backdrop-blur, semi-transparent bg).
- Expanded/modal view uses shadcn `Dialog` component.
- State: `showReferencePanel: boolean` toggle in App, reference images derived from `activeProject.referenceImages`.

### Out of Scope

- AI-powered image-to-geometry analysis.
- Persistent image storage backend.

---

## Feature 2: Dynamic Infill System

### Problem

The infill (honeycomb, triangle grid) is currently a standalone project (`TriangleInfill`). Infill should be a **reusable option available to any mesh** in any project. Additionally, when the containing structure's dimensions change, the infill does not recalculate to fit — it should always adapt to the current geometry bounds.

### Goal

Make infill a toggleable, configurable feature that any project's mesh can opt into. When the parent shape's parameters change, the infill automatically recalculates to fill the new bounds.

### Requirements

**P0 — Must have:**

- **Infill as a toggle:** Each project can declare which parts support infill. A checkbox or toggle in the parameter panel enables/disables infill for that part.
- **Infill recalculates on parameter change:** When any parameter that affects the containing shape's geometry changes (dimensions, angles, counts), the infill geometry is recomputed via `useMemo` with the updated bounds as dependencies.
- **Infill configuration panel:** When infill is enabled, expose sub-parameters:
  - Pattern type (none / honeycomb / triangle grid / lines — extensible enum)
  - Density / cell size
  - Wall thickness
  - Pattern origin (center / corner)
- **Works with the existing TriangleInfill project:** The current triangle infill is refactored into a shared `InfillGenerator` utility that takes a bounding shape (as a `THREE.Shape` or `THREE.BufferGeometry` cross-section) and infill config, and returns the infill geometry.

**P1 — Should have:**

- Infill available for all existing projects (WavyStructure base slab, Paralette feet, etc.) — not just triangle.
- Infill respects per-part overrides (e.g. if a part is scaled, infill adapts).
- Infill preview mode: wireframe-only rendering of the infill before committing.

**P2 — Nice to have:**

- Variable-density infill (denser near edges, sparser in the center).
- Custom infill patterns defined by SVG path import.

### Technical Approach

- Extract infill generation from `TriangleInfill.tsx` into a shared utility: `src/lib/infill.ts`.
- The utility exposes: `generateInfill(boundingShape: THREE.Shape, config: InfillConfig): THREE.BufferGeometry`.
- CSG intersection (already using `three-bvh-csg`) clips the infill to the bounding shape.
- Each 3D component that supports infill passes its inner shape to `generateInfill` inside the same `useMemo` that builds the main geometry — ensuring they stay in sync.
- `ParamDef` gets a new `group: 'Infill'` section with the infill sub-parameters. The infill toggle is a new boolean-like param (encoded as 0/1 number, consistent with existing `options` pattern).
- The `projects.ts` `defaultParams` includes infill params (e.g. `infillEnabled: 0, infillPattern: 2, infillDensity: 5, infillThickness: 0.1`).

### Key Constraint

- CSG operations are synchronous and can block the main thread. For complex geometries, consider debouncing parameter changes or showing a loading indicator during recomputation. A web worker for CSG is a future optimization, not required for this iteration.

---

## Feature 3: Real-World Unit System

### Problem

All dimensions are displayed as unitless Three.js scene values (e.g. "Width: 3.50"). Users have no idea what physical size their object will be when 3D-printed or manufactured. STL files are unitless by convention but slicers typically interpret them as millimeters.

### Goal

Let users work in real-world metric units (mm, cm) so they know the exact physical dimensions of their model, and ensure exported STL/GLB files produce correctly-sized prints.

### Requirements

**P0 — Must have:**

- **Global unit setting:** A dropdown in the UI (top bar or settings area) to select the working unit: `mm` or `cm`. Default: `mm`.
- **Unit convention:** Define that **1 Three.js unit = 1 unit in the selected system**. So if the user is working in mm, a `width` parameter of `35` means 35 mm.
  - This is the simplest approach: the scene unit IS the real unit. No conversion math needed in the geometry code.
  - The parameter sliders' min/max/step values and `defaultParams` are authored in mm by default.
- **Display units in the UI:** Every parameter label shows the unit suffix (e.g. "Base Width: 35.0 mm" instead of "Base Width: 3.50").
- **Rescale on unit switch:** When the user switches from mm to cm (or vice versa), all parameter values are automatically converted (÷10 or ×10) so the model stays the same physical size. The slider min/max/step also rescale.
- **STL export note:** STL files are conventionally interpreted as mm by slicers. If the user is working in cm, the exporter multiplies all coordinates by 10 before writing STL so the slicer reads correct mm values. GLB export embeds no unit metadata (Three.js convention is meters for glTF, so the exporter should scale accordingly — divide by 1000 if working in mm).

**P1 — Should have:**

- **Dimension readout:** A small info box showing the overall bounding box of the current model in the selected unit (e.g. "120 × 80 × 45 mm").
- **Inches support:** Add `in` as a third unit option with appropriate conversions (1 in = 25.4 mm).
- **Grid overlay:** Optional grid plane in the scene with unit-labeled gridlines (every 10 mm, every 1 cm, etc.).

**P2 — Nice to have:**

- Per-parameter unit override (e.g. angles always in degrees regardless of length unit).
- Ruler/measurement tool: click two points in the scene and see the distance in current units.

### Technical Approach

**Option A — Scene-unit-equals-real-unit (Recommended):**

- 1 Three.js unit = 1 mm (default). All `defaultParams` are authored in mm.
- `ParameterPanel` appends the unit label from a global `unit` state.
- When switching units, a `convertParams(params, fromUnit, toUnit)` utility scales all length-type params. `ParamDef` gets a `unitType: 'length' | 'angle' | 'count' | 'ratio'` field so only length params are converted.
- STL exporter: if working unit is mm, export as-is (slicer expects mm). If cm, multiply by 10. If inches, multiply by 25.4.
- GLB exporter: glTF spec says meters. Divide mm values by 1000.

**Option B — Internal scale factor (Not recommended):**

- Keep scene units abstract, store a `scaleToMM` factor, and apply it only at display/export time. This adds complexity with no real benefit since Three.js has no inherent unit system.

**Decision: Go with Option A.**

### Migration

- Existing `defaultParams` need to be rescaled from their current abstract values to mm-scale values. For example, the WavyStructure's `baseWidth: 3.5` would become `baseWidth: 35` (interpreting the original as ~35 mm). This is a one-time migration per project.

---

## Feature 4: Multi-Select Enhancements

### Problem

Currently, selecting multiple parts requires Cmd/Ctrl+clicking each one individually. For scenes with many parts (e.g. many fins in WavyStructure), this is tedious. Users want faster ways to select groups of parts.

### Goal

Provide "Select All" and box/lasso selection (shift+drag) for efficient multi-part selection.

### Requirements

**P0 — Must have:**

- **Select All button:** A button in the SelectionPanel header (or a keyboard shortcut like `Cmd+A` / `Ctrl+A`) that selects every part in the current project.
- **Deselect All:** `Escape` key deselects all (in addition to clicking empty space).
- **Box selection (shift+drag):** Hold `Shift` and drag on the canvas to draw a 2D selection rectangle. On mouse-up, all parts whose screen-projected bounding box intersects the rectangle become selected.
  - If `Cmd/Ctrl` is also held during the box select, the new parts are added to the existing selection (union). Otherwise, the box selection replaces the current selection.

**P1 — Should have:**

- **Visual feedback during box select:** Render a dashed-border rectangle overlay on the canvas as the user drags, so they can see what area they're selecting.
- **Invert selection:** A button or shortcut (`Cmd+I`) that selects all unselected parts and deselects all selected ones.
- **Select by type/group:** If parts have categories (e.g. "fins", "ribs", "base"), a dropdown to select all parts of a given type.

**P2 — Nice to have:**

- Lasso selection (freeform drag path instead of rectangle).
- Selection history (undo last selection change).

### Technical Approach

**Select All / Deselect All:**

- Each 3D component exposes a `getAllPartIds(): string[]` method on its `ProjectHandle`.
- `Cmd+A` handler in App calls `handleRef.current.getAllPartIds()` and sets all as selected.
- `Escape` handler clears `selectedIds`.

**Box Selection:**

- A transparent `<div>` overlay on the Canvas captures `onPointerDown` / `onPointerMove` / `onPointerUp` when Shift is held.
- On drag, render a styled selection rectangle (absolute positioned, dashed border, semi-transparent fill).
- On mouse-up, for each part in the scene:
  1. Get the part mesh's world-space bounding box (`THREE.Box3`).
  2. Project the 8 corners to screen coordinates using the camera's projection matrix.
  3. Compute the 2D screen-space bounding box of those projected points.
  4. Test intersection with the drag rectangle.
  5. If intersecting, add the part's ID to the selection set.
- The 3D component needs to expose `getPartBounds(): Map<string, THREE.Box3>` on its handle, returning the world-space bounding box for each part ID.
- Alternatively, use Three.js raycasting with a `SelectionBox` helper from `three/addons/interactive/SelectionBox` (exists in Three.js examples).

**Integration with existing selection:**

- The existing `onSelectionChange` callback is reused. Box selection simply calls it with the computed set of IDs.
- The 3D component's local `selectedIds` state is updated via a new `setSelection(ids: Set<string>)` method on the handle, or by having App pass `selectedIds` down as a prop (making App the source of truth instead of the component).

### Architectural Consideration

Currently, selection state lives inside each 3D component and is synced up to App via `onSelectionChange`. For box selection to work, App needs to be able to **push** selection state down. This suggests **lifting selection state fully to App** — making `selectedIds` a prop passed down to the 3D component rather than component-local state. This is a refactor but simplifies the data flow and is needed for features like Select All and box select.

---

## Priority & Sequencing

| Feature              | Priority | Effort | Dependencies                                   |
| -------------------- | -------- | ------ | ---------------------------------------------- |
| F3: Unit System      | P0       | Medium | None — foundational, do first                  |
| F2: Dynamic Infill   | P0       | High   | Benefits from F3 (infill params in real units) |
| F1: Reference Images | P1       | Low    | None                                           |
| F4: Multi-Select     | P1       | Medium | Selection state refactor (lift state to App)   |

**Recommended order:** F3 → F1 → F2 → F4

- **F3 first** because it's foundational — every subsequent feature benefits from having real units.
- **F1 next** because it's low effort and immediately useful during F2 development (comparing infill output to references).
- **F2 next** as the highest-effort feature that builds on the unit system.
- **F4 last** because it requires the selection state refactor and is most valuable once there are more complex scenes with many parts (which F2 enables).

---

## Resolved Questions

1. **Default unit:** `mm` (confirmed).
2. **Infill scope:** Start with 2D cross-section shapes (extruded profiles), extend to 3D volumes later.
3. **Reference image persistence:** Use repo-based files from `examples/`. This repo is designed for local use — no upload backend needed.
4. **Selection state ownership:** Lifting selection to App is a refactor. Confirm acceptable before starting F4.

## Implementation Order (Current Session)

1. **F3: Real-World Unit System** — implement first
2. **F1: Reference Image Viewer** — implement second
