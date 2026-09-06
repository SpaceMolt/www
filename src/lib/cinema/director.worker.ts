import { compileBattleFilm } from './director'
import type { CinemaWorkerRequest, CinemaWorkerResponse } from './types'

self.onmessage = (event: MessageEvent<CinemaWorkerRequest>) => {
  let response: CinemaWorkerResponse
  try {
    const { summary, entries, reconciled } = event.data
    response = { film: compileBattleFilm(summary, entries, reconciled === true) }
  } catch (error) {
    response = { error: error instanceof Error ? error.message : 'Unable to direct this battle.' }
  }
  self.postMessage(response)
}
