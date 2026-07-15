export function configureHiDPICanvas(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): void {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? devicePixelRatio
    : 1
  const width = Number.isFinite(cssWidth) && cssWidth >= 0 ? cssWidth : 0
  const height = Number.isFinite(cssHeight) && cssHeight >= 0 ? cssHeight : 0

  canvas.width = Math.max(1, Math.round(width * dpr))
  canvas.height = Math.max(1, Math.round(height * dpr))
  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
}

export function logicalCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } {
  return { width: canvas.clientWidth, height: canvas.clientHeight }
}
