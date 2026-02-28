import * as THREE from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

/**
 * Clone the model and rotate from Three.js Y-up to STL/CAD Z-up convention.
 */
function cloneForExport(group: THREE.Object3D): THREE.Object3D {
  const clone = group.clone(true)
  const wrapper = new THREE.Group()
  wrapper.add(clone)
  // Rotate +90deg around X to convert Y-up → Z-up
  wrapper.rotation.x = Math.PI / 2
  wrapper.updateMatrixWorld(true)
  return wrapper
}

export function downloadSTL(group: THREE.Object3D, filename: string) {
  const exportScene = cloneForExport(group)
  const exporter = new STLExporter()
  const result = exporter.parse(exportScene, { binary: true })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  triggerDownload(blob, `${filename}.stl`)
}

export async function downloadGLB(group: THREE.Object3D, filename: string) {
  const exporter = new GLTFExporter()
  // GLB/glTF uses Y-up natively (same as Three.js), no rotation needed
  const result = await exporter.parseAsync(group, { binary: true })
  const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
  triggerDownload(blob, `${filename}.glb`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
