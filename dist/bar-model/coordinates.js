import { screenToWorld } from "../core.js?v=14";

// SVG uses xMidYMid meet: exclude letterboxing before applying the camera.
export function pointerToViewport(pointer, rect, width = 800, height = 400) {
  const scale = Math.min(rect.width / width, rect.height / height);
  return {
    x: (pointer.clientX - rect.left - (rect.width - width * scale) / 2) / scale,
    y:
      (pointer.clientY - rect.top - (rect.height - height * scale) / 2) / scale,
  };
}
export function pointerToWorld(pointer, rect, view) {
  return screenToWorld(pointerToViewport(pointer, rect), view);
}
