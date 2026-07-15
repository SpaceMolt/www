import { describe, expect, test } from 'bun:test'
import { configureHiDPICanvas, logicalCanvasSize } from './canvasResolution'

describe('configureHiDPICanvas', () => {
  test('uses physical backing pixels while preserving CSS-space drawing coordinates', () => {
    const canvas = {
      width: 0,
      height: 0,
      style: { width: '', height: '' },
    }
    const transforms: number[][] = []
    const context = {
      setTransform: (...values: number[]) => transforms.push(values),
    }

    configureHiDPICanvas(
      canvas as unknown as HTMLCanvasElement,
      context as unknown as CanvasRenderingContext2D,
      800,
      450,
      2,
    )

    expect(canvas.width).toBe(1600)
    expect(canvas.height).toBe(900)
    expect(canvas.style.width).toBe('800px')
    expect(canvas.style.height).toBe('450px')
    expect(transforms).toEqual([[2, 0, 0, 2, 0, 0]])
  })

  test('falls back to one backing pixel per CSS pixel for invalid DPR values', () => {
    const canvas = { width: 0, height: 0, style: { width: '', height: '' } }
    const context = { setTransform() {} }

    configureHiDPICanvas(
      canvas as unknown as HTMLCanvasElement,
      context as unknown as CanvasRenderingContext2D,
      640,
      360,
      0,
    )

    expect(canvas.width).toBe(640)
    expect(canvas.height).toBe(360)
  })

  test('interaction geometry uses CSS pixels instead of the HiDPI backing size', () => {
    const canvas = {
      width: 1600,
      height: 900,
      clientWidth: 800,
      clientHeight: 450,
    }

    expect(logicalCanvasSize(canvas as unknown as HTMLCanvasElement)).toEqual({
      width: 800,
      height: 450,
    })
  })
})
