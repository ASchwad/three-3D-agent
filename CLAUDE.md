# Three.js 3D Builder - Project Instructions

## Tech Stack
- React 19 + TypeScript + Vite
- Three.js with @react-three/fiber and @react-three/drei
- shadcn/ui components + Tailwind CSS v4
- TanStack React Query

## Screenshots
- All Playwright/MCP screenshots MUST be saved to `screenshots/` (e.g. `filename: "screenshots/my-screenshot.png"`). Never save screenshots to the repo root.

## Project Structure
- Root directory contains the React frontend application
- `threejs-skills/` - Three.js skill documentation for Claude Code
- `screenshots/` - WIP screenshots (gitignored)
- `examples/` - Reference images organized by project

## 3D Component Generation Rules

### 1. Always Surface Key Parameters as Interactive UI Controls

When creating or modifying any 3D component, you MUST:

- **Extract all meaningful numeric parameters** (dimensions, distances, angles, counts, spacing, wave amplitudes, radii, heights, thicknesses, etc.) into React state using `useState` hooks instead of hard-coded constants.
- **Render a control panel** in the frontend using shadcn `Slider`, `Input`, or `Label` components so the user can interactively adjust these parameters in real-time.
- **Group parameters logically** in the UI panel (e.g. "Dimensions", "Wave Profile", "Material", "Counts & Spacing").
- **Provide sensible min/max/step constraints** for each slider so users can't break the geometry.
- **Use descriptive labels** that explain what each parameter controls (e.g. "Fin Count", "Wave Amplitude", "Base Width").

#### Example pattern for parametric components:

```tsx
// In the 3D component file:
interface MyShapeProps {
  width: number
  height: number
  finCount: number
  waveAmplitude: number
  // ... all key parameters as props
}

export default function MyShape({ width, height, finCount, waveAmplitude }: MyShapeProps) {
  // Use props instead of hard-coded constants
  const geometry = useMemo(() => {
    // ... geometry using the prop values
  }, [width, height, finCount, waveAmplitude])
  // ...
}
```

```tsx
// In the parent/App component or a dedicated ParameterPanel:
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'

function ParameterPanel({ params, onChange }) {
  return (
    <div className="absolute top-4 right-4 w-72 bg-background/90 backdrop-blur border rounded-lg p-4 space-y-4 z-10 max-h-[80vh] overflow-y-auto">
      <h3 className="font-semibold text-sm">Parameters</h3>
      <div>
        <Label>Width: {params.width.toFixed(2)}</Label>
        <Slider min={0.5} max={10} step={0.1} value={[params.width]} onValueChange={([v]) => onChange({ ...params, width: v })} />
      </div>
      {/* ... more parameters */}
    </div>
  )
}
```

**Key principle:** A user looking at the 3D model should be able to tweak every important geometric parameter (distances, angles, counts, sizes, material properties) from the UI without touching code.

### 2. Always Make Objects Clickable and Deletable

When creating 3D scenes with multiple objects or sub-parts, you MUST:

- **Track objects in state** using an array or map so individual objects can be identified and removed.
- **Add click handlers** to meshes using react-three-fiber's `onClick` event prop (which uses raycasting under the hood).
- **Highlight on hover** by changing color or adding an outline when the cursor hovers over a clickable object (use `onPointerOver` / `onPointerOut`).
- **Delete on click** or provide a delete mode/button. When an object is clicked, either:
  - Remove it from state immediately (if in "delete mode"), OR
  - Select it first (highlight it), then allow deletion via a Delete/Backspace key or a UI button.
- **Use `e.stopPropagation()`** in click handlers to prevent click events from propagating to parent groups or the canvas.

#### Example pattern for selectable/deletable objects:

```tsx
const [objects, setObjects] = useState<ObjectData[]>(initialObjects)
const [selectedId, setSelectedId] = useState<string | null>(null)

function handleDelete() {
  if (selectedId) {
    setObjects(prev => prev.filter(obj => obj.id !== selectedId))
    setSelectedId(null)
  }
}

// Listen for Delete/Backspace key
useEffect(() => {
  const handler = (e: KeyboardEvent) => {
    if (e.key === 'Delete' || e.key === 'Backspace') handleDelete()
  }
  window.addEventListener('keydown', handler)
  return () => window.removeEventListener('keydown', handler)
}, [selectedId])

// In the scene:
{objects.map(obj => (
  <mesh
    key={obj.id}
    onClick={(e) => { e.stopPropagation(); setSelectedId(obj.id) }}
    onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer' }}
    onPointerOut={() => { document.body.style.cursor = 'default' }}
  >
    <meshStandardMaterial
      color={selectedId === obj.id ? '#ff6b6b' : obj.color}
    />
  </mesh>
))}
```

- The UI should also show a visible "Delete Selected" button and a hint about keyboard shortcut.
- Clicking on empty space (the canvas background) should deselect the currently selected object.

### 3. UI Panel Positioning

- Parameter panels should be positioned as an **overlay on top of the 3D canvas** using absolute positioning (e.g. `absolute top-4 right-4`).
- Use `backdrop-blur` and semi-transparent background so the 3D view remains partially visible behind the panel.
- The panel should be scrollable if it has many parameters (`max-h-[80vh] overflow-y-auto`).
- Keep the panel compact - use shadcn's small component variants where possible.

### 4. Each Reference Image = A Separate Project

When the user provides a new reference image to build a 3D object from, treat it as a **new project**. You MUST:

- **Create a new component file** in `src/components/` for each project (e.g. `WavyStructure.tsx`, `BracketMount.tsx`, `GearAssembly.tsx`).
- **Register it in a central project list.** Maintain a `src/projects.ts` file that exports an array of project definitions:

```ts
// src/projects.ts
import { lazy, type ComponentType } from 'react'

export interface ProjectParams {
  [key: string]: number
}

export interface Project {
  id: string
  name: string
  description: string
  component: React.LazyExponent<ComponentType<{ params: ProjectParams; onParamsChange: (p: ProjectParams) => void }>>
  defaultParams: ProjectParams
}

export const projects: Project[] = [
  {
    id: 'wavy-structure',
    name: 'Wavy Structure',
    description: 'Parametric wavy fin structure with cross ribs',
    component: lazy(() => import('./components/WavyStructure')),
    defaultParams: { baseWidth: 3.5, baseDepth: 2.8, finCount: 6, waveAmplitude: 0.4 },
  },
  // ... add new projects here as they are created
]
```

- **Add a project switcher in the UI.** The left side of the screen should have a sidebar or top bar that lists all projects. Clicking a project loads its 3D component and its parameter panel into the canvas area.
- **Each project is independent.** Switching projects swaps out both the 3D scene content and the parameter panel. Each project maintains its own parameter state.
- **When creating a new 3D object from a reference image**, always:
  1. Create the new component file in `src/components/`
  2. Add an entry to `src/projects.ts`
  3. The app will automatically pick it up in the project switcher

#### Example project switcher pattern:

```tsx
// In App.tsx or a ProjectSidebar component:
import { projects } from './projects'

const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id)
const activeProject = projects.find(p => p.id === activeProjectId)

// Sidebar
<div className="absolute top-4 left-4 w-56 bg-background/90 backdrop-blur border rounded-lg p-3 z-10">
  <h3 className="font-semibold text-sm mb-2">Projects</h3>
  {projects.map(p => (
    <button
      key={p.id}
      onClick={() => setActiveProjectId(p.id)}
      className={cn("w-full text-left px-3 py-2 rounded text-sm", activeProjectId === p.id && "bg-primary text-primary-foreground")}
    >
      {p.name}
    </button>
  ))}
</div>

// In the Canvas, render the active project's component:
<Suspense fallback={null}>
  {activeProject && <activeProject.component params={params} onParamsChange={setParams} />}
</Suspense>
```

**Key principle:** The app should feel like a portfolio of 3D models. Each reference image the user gives you becomes a new entry the user can switch to, inspect, and tweak independently.

### 5. Geometry Iteration Discipline

When building or modifying 3D geometry to match a reference image:

- **Plan the 2D profile before coding.** Identify every geometric primitive (lines, arcs, circles) and their exact center points. Don't start coding until you know what shapes you're combining and where each arc center lives.
- **Prefer one mesh over multiple.** Adding a separate mesh to fix a proportion issue (e.g. a LatheGeometry tube to add a barrel) introduces z-fighting, alignment, and visual seam problems. Fix the 2D profile of a single ExtrudeGeometry first. Only add a second mesh when mathematically necessary (different topology).
- **Define arc centers explicitly.** Never rely on fillet/offset math to "end up" at the right center. If a circular feature must be centered at a specific point (e.g. a bore hole), construct the arc with that center directly using `lineCircleIntersect` + manual arc points.
- **Stop tweaking multipliers after 2 failed attempts.** If adjusting a coefficient (`T * 0.35` → `T * 0.5` → `T * 0.8`) doesn't converge toward the reference, the underlying geometric approach is wrong. Step back and rethink the construction method.
- **Use headless screenshots.** Use `scripts/capture-headless.cjs` (Playwright headless) instead of MCP browser tools. Capture after every geometry change, not after batching multiple changes.
- **Vite HMR preserves React state.** Changing `defaultParams` in `projects.ts` won't take effect until a full page reload. The headless script should navigate fresh each time.

### 6. General Component Guidelines

- Keep all 3D components in `src/components/`.
- Use `useMemo` for geometry creation that depends on parameters to avoid re-creating on every render.
- Every 3D component should accept its key parameters as props (not internal constants).
- Material properties (color, roughness, metalness) should also be adjustable where relevant.
- When creating a new 3D component from a reference image, always follow the project registration flow from Rule 4.
