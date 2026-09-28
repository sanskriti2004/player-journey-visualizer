export type EventType = 'Kill' | 'Killed' | 'BotKill' | 'BotKilled' | 'KilledByStorm' | 'Loot'

export type Outcome = 'storm' | 'killed_by_player' | 'killed_by_bot' | 'killed' | 'survived'

export interface MapInfo {
  id: string
  name: string
  scale: number
  originX: number
  originZ: number
  image: string
}

export interface MatchSummary {
  id: string
  map: string
  day: string
  startedAt: number
  duration: number
  humans: number
  bots: number
  kills: number
  deaths: number
  stormDeaths: number
  loot: number
}

export interface Manifest {
  maps: MapInfo[]
  days: string[]
  matches: MatchSummary[]
}

/** [secondsSinceMatchStart, u, v, event] */
export type GameEvent = [number, number, number, EventType]

export interface Player {
  id: string
  bot: boolean
  outcome: Outcome
  /** Flat [t, u, v, t, u, v, ...] of position samples, sorted by t. */
  path: number[]
  events: GameEvent[]
}

export interface MatchData {
  players: Player[]
}

export interface MapData {
  matches: Record<string, MatchData>
}

export type EventGroup = 'kill' | 'death' | 'storm' | 'loot'
export type HeatmapMode = 'off' | 'traffic' | EventGroup

export interface Layers {
  humans: boolean
  bots: boolean
  kill: boolean
  death: boolean
  storm: boolean
  loot: boolean
}
