import { expect, test } from 'bun:test'
import fs from 'fs'
import path from 'path'

/*
 * The native number stepper is unstyled and sits on top of the digits (a player
 * reported it "overlaps the number"). /play hides it on every number input in one
 * globals.css rule; quantity fields carry QtyButtons instead.
 */
const css = fs.readFileSync(path.join(process.cwd(), 'src', 'app', 'globals.css'), 'utf8').replace(/\s+/g, ' ')

test('/play hides the native number stepper in Gecko and WebKit', () => {
  expect(css).toContain("body.play-page input[type='number'] { -moz-appearance: textfield; appearance: textfield; }")
  expect(css).toContain(
    "body.play-page input[type='number']::-webkit-outer-spin-button, body.play-page input[type='number']::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }",
  )
})
