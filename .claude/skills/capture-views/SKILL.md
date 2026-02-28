---
name: capture-views
description: Take screenshots of the active 3D model from standard camera angles (front, side, top, perspective) and save them for comparison with reference images. Use when developing or iterating on a 3D model.
argument-hint: [project-id]
allowed-tools:
  - Bash
  - Read
  - Glob
  - mcp__playwright__browser_navigate
  - mcp__playwright__browser_evaluate
  - mcp__playwright__browser_take_screenshot
  - mcp__playwright__browser_wait_for
  - mcp__playwright__browser_resize
  - mcp__playwright__browser_close
  - mcp__playwright__browser_snapshot
  - mcp__playwright__browser_run_code
---

# Capture Views

Take standardized screenshots of the active 3D model from multiple camera angles and save them locally for comparison with reference images.

## Instructions

### 1. Ensure the dev server is running

```bash
# Check if the dev server is already running on port 5173
lsof -i :5173 | grep LISTEN
```

If NOT running, start it in the background:
```bash
cd /Users/aschwad/Documents/Dev/3D-Stuff/three-3D-agent/three-3d-builder && yarn dev &
```

Wait a few seconds for the server to start.

### 2. Set up the browser

- Navigate to `http://localhost:5173`
- Resize the browser to **1200x900** for consistent screenshots
- Wait 2 seconds for the 3D scene to fully render

### 3. Switch to the target project (if specified)

If `$ARGUMENTS` contains a project ID (e.g., "paralette", "wavy-structure", "triangle-infill"):
- Use `browser_snapshot` to find the project switcher sidebar
- Click on the matching project button

If no argument is provided, use whatever project is currently active.

### 4. Determine the active project ID

Run this via `browser_evaluate`:
```js
() => {
  // Read the active project from the highlighted button in the sidebar
  const active = document.querySelector('[class*="bg-primary"]');
  return active ? active.textContent.trim().split('\n')[0] : 'unknown';
}
```

### 5. Hide UI panels for clean screenshots

```js
() => { window.__three3d.hideUI(); }
```

### 6. Capture each view

For each of these views: **front**, **right**, **top**, **perspective**:

a) Set the camera view:
```js
() => { return window.__three3d.setCameraView('front'); }
```

b) Wait 500ms for the render to settle

c) Take a screenshot and save it to the project's examples directory:
```
examples/{project-id}/current-front.png
examples/{project-id}/current-right.png
examples/{project-id}/current-top.png
examples/{project-id}/current-perspective.png
```

Use the **absolute path** for the filename parameter:
`/Users/aschwad/Documents/Dev/3D-Stuff/three-3D-agent/examples/{project-id}/current-{view}.png`

Create the directory first if it doesn't exist:
```bash
mkdir -p /Users/aschwad/Documents/Dev/3D-Stuff/three-3D-agent/examples/{project-id}
```

### 7. Restore UI panels

```js
() => { window.__three3d.showUI(); }
```

### 8. Compare with reference images

After all screenshots are taken:

1. Check for reference images in the same directory:
   ```
   examples/{project-id}/front-view.png
   examples/{project-id}/three-quarter-view.png
   examples/{project-id}/side-view.png
   examples/{project-id}/top-view.png
   ```

2. Read both the current screenshots AND the reference images using the Read tool (it can display images).

3. Provide a visual comparison report:
   - What matches well between current and reference
   - What differs significantly
   - Specific suggestions for what to fix

## Available Camera Views

The app exposes `window.__three3d` with these methods:

- `setCameraView(name)` - Auto-frames the model from a named angle:
  - `front` - Straight-on from the front (along +Z axis)
  - `back` - From behind (along -Z axis)
  - `right` - From the right side (along +X axis)
  - `left` - From the left side (along -X axis)
  - `top` - Bird's eye view from above
  - `perspective` - 3/4 angle view

- `setCameraPosition(x, y, z, tx, ty, tz)` - Set explicit camera position and look-at target

- `hideUI()` / `showUI()` - Toggle overlay panels for clean screenshots

## File Locations

- **Dev server**: http://localhost:5173
- **Project root**: /Users/aschwad/Documents/Dev/3D-Stuff/three-3D-agent
- **App directory**: /Users/aschwad/Documents/Dev/3D-Stuff/three-3D-agent/three-3d-builder
- **Examples**: /Users/aschwad/Documents/Dev/3D-Stuff/three-3D-agent/examples/{project-id}/

## Output

After execution, report:
- Paths to all saved screenshots
- Comparison with any existing reference images
- Actionable suggestions for improving the model
