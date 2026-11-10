/**
 * Treasury balance to show beside the deposit/withdraw controls, or undefined to hide them.
 * Credits move to and from the treasury anywhere, docked or not, so the controls do not need a dock.
 * A loaded storage view has the freshest balance; otherwise use the faction info's treasury.
 */
export function treasuryBalance({ view, info }: {
  view?: { credits: number }
  info?: { treasury?: number }
}): number | undefined {
  return view?.credits ?? info?.treasury
}
