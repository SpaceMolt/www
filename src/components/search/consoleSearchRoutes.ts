/** Full-page workspaces own the corner used by the floating search trigger. */
export function shouldShowConsoleSearchField(pathname: string): boolean {
  return pathname !== '/intel' && !/^\/battles\/[^/]+\/?$/.test(pathname)
}
