import type { EventGroup, EventType, Outcome } from '../types'

export const EVENT_GROUP: Record<EventType, EventGroup> = {
  Kill: 'kill',
  BotKill: 'kill',
  Killed: 'death',
  BotKilled: 'death',
  KilledByStorm: 'storm',
  Loot: 'loot',
}

export const GROUP_STYLE: Record<EventGroup, { label: string; color: string }> = {
  kill: { label: 'Kills', color: '#e66767' },
  death: { label: 'Deaths', color: '#f2f2ee' },
  storm: { label: 'Storm deaths', color: '#9085e9' },
  loot: { label: 'Loot pickups', color: '#fab219' },
}

export const PATH_COLOR = { human: '#4b9cf0', bot: '#e8773f' }

/** Events are logged from the file owner's perspective, for humans and bots alike. */
export function describeEvent(e: EventType, actorIsBot: boolean): string {
  const who = actorIsBot ? 'Bot' : 'Player'
  switch (e) {
    case 'Kill': return `${who} killed a human player`
    case 'Killed': return `${who} killed by a human player`
    case 'BotKill': return actorIsBot ? 'Bot got a kill' : 'Player killed a bot'
    case 'BotKilled': return actorIsBot ? 'Bot was killed' : 'Player killed by a bot'
    case 'KilledByStorm': return `${who} died to the storm`
    case 'Loot': return `${who} picked up loot`
  }
}

export const OUTCOME_LABEL: Record<Outcome, string> = {
  survived: 'No death logged',
  killed_by_bot: 'Killed by bot',
  killed_by_player: 'Killed by player',
  killed: 'Killed',
  storm: 'Died to storm',
}
