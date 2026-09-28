import { EVENT_GROUP, GROUP_STYLE, OUTCOME_LABEL, PATH_COLOR } from '../lib/events'
import { shortId } from '../lib/format'
import { HEAT_GRADIENT_CSS } from '../lib/heatmap'
import type { EventGroup, HeatmapMode, Layers } from '../types'
import { journeyKey, type Journey } from './MapCanvas'

const GROUPS: EventGroup[] = ['kill', 'death', 'storm', 'loot']

const HEAT_OPTIONS: { id: HeatmapMode; label: string; hint: string }[] = [
  { id: 'off', label: 'Off', hint: '' },
  { id: 'traffic', label: 'Traffic', hint: 'Where players spend time (position samples every ~5 s)' },
  { id: 'kill', label: 'Kills', hint: 'Where kills are made (shooter position)' },
  { id: 'death', label: 'Deaths', hint: 'Where players and bots die in combat' },
  { id: 'storm', label: 'Storm', hint: 'Where players die to the storm' },
  { id: 'loot', label: 'Loot', hint: 'Where items are picked up' },
]

export function MarkerIcon({ group }: { group: EventGroup }) {
  const c = GROUP_STYLE[group].color
  const ring = '#0a0b0e'
  return (
    <svg width="16" height="16" viewBox="-8 -8 16 16" aria-hidden>
      {group === 'kill' && (
        <g fill="none" strokeLinecap="round">
          {[ring, c].map((s, i) => (
            <g key={s} stroke={s} strokeWidth={i ? 1.8 : 4.3}>
              <path d="M-5.5 0H5.5M0 -5.5V5.5" />
              <circle r="3" />
            </g>
          ))}
        </g>
      )}
      {group === 'death' && (
        <g strokeLinecap="round">
          <path d="M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5" stroke={ring} strokeWidth="4.7" />
          <path d="M-4.5 -4.5L4.5 4.5M4.5 -4.5L-4.5 4.5" stroke={c} strokeWidth="2.2" />
        </g>
      )}
      {group === 'storm' && <path d="M0 -6L6 0L0 6L-6 0Z" fill={c} stroke={ring} strokeWidth="1.5" />}
      {group === 'loot' && (
        <>
          <rect x="-4" y="-4" width="8" height="8" fill={ring} />
          <rect x="-3" y="-3" width="6" height="6" fill={c} />
        </>
      )}
    </svg>
  )
}

function PathIcon({ bot }: { bot: boolean }) {
  return (
    <svg width="22" height="10" aria-hidden>
      <line x1="1" y1="5" x2="21" y2="5" stroke={bot ? PATH_COLOR.bot : PATH_COLOR.human} strokeWidth="2.5" strokeDasharray={bot ? '4 3' : undefined} strokeLinecap="round" />
    </svg>
  )
}

interface Props {
  journeys: Journey[]
  layers: Layers
  heat: HeatmapMode
  heatRadius: number
  aggregate: boolean
  focus: string | null
  onLayers: (l: Layers) => void
  onHeat: (h: HeatmapMode) => void
  onHeatRadius: (r: number) => void
  onFocus: (key: string | null) => void
}

export default function LayerPanel({ journeys, layers, heat, heatRadius, aggregate, focus, onLayers, onHeat, onHeatRadius, onFocus }: Props) {
  const humans = journeys.filter((j) => !j.player.bot).length
  const bots = journeys.length - humans
  const counts: Record<EventGroup, number> = { kill: 0, death: 0, storm: 0, loot: 0 }
  for (const j of journeys) {
    if (j.player.bot ? !layers.bots : !layers.humans) continue
    for (const e of j.player.events) counts[EVENT_GROUP[e[3]]]++
  }
  const toggle = (k: keyof Layers) => onLayers({ ...layers, [k]: !layers[k] })
  const heatHint = HEAT_OPTIONS.find((o) => o.id === heat)?.hint

  return (
    <aside className="panel">
      <section>
        <h2>Journeys</h2>
        <label className="toggle">
          <input type="checkbox" checked={layers.humans} onChange={() => toggle('humans')} />
          <PathIcon bot={false} />
          <span>Humans</span>
          <small>{humans}</small>
        </label>
        <label className="toggle">
          <input type="checkbox" checked={layers.bots} onChange={() => toggle('bots')} />
          <PathIcon bot />
          <span>Bots</span>
          <small>{bots}</small>
        </label>
      </section>

      <section>
        <h2>Events</h2>
        {GROUPS.map((g) => (
          <label className="toggle" key={g}>
            <input type="checkbox" checked={layers[g]} onChange={() => toggle(g)} />
            <MarkerIcon group={g} />
            <span>{GROUP_STYLE[g].label}</span>
            <small>{counts[g]}</small>
          </label>
        ))}
      </section>

      <section>
        <h2>Heatmap</h2>
        <div className="heat-options" role="radiogroup" aria-label="Heatmap">
          {HEAT_OPTIONS.map((o) => (
            <button key={o.id} role="radio" aria-checked={heat === o.id} className={heat === o.id ? 'active' : ''} onClick={() => onHeat(o.id)}>
              {o.label}
            </button>
          ))}
        </div>
        {heat !== 'off' && (
          <>
            <p className="hint block">{heatHint}</p>
            <div className="heat-legend">
              <span>fewer</span>
              <i style={{ background: HEAT_GRADIENT_CSS }} />
              <span>more</span>
            </div>
            <label className="slider">
              <span>Spread</span>
              <input type="range" min={1} max={8} value={heatRadius} onChange={(e) => onHeatRadius(Number(e.target.value))} />
            </label>
          </>
        )}
      </section>

      <section className="shortcuts">
        <h2>Controls</h2>
        <p>
          Drag to pan · scroll or double-click to zoom · <kbd>Space</kbd> play/pause · <kbd>←</kbd>/<kbd>→</kbd> ±10 s ·{' '}
          <kbd>Esc</kbd> clear highlight
        </p>
      </section>

      {!aggregate && (
        <section className="players">
          <h2>
            Players in match <span className="hint">click to highlight</span>
          </h2>
          <ul>
            {journeys.map((j) => {
              const key = journeyKey(j)
              const kills = j.player.events.filter((e) => EVENT_GROUP[e[3]] === 'kill').length
              const loot = j.player.events.filter((e) => e[3] === 'Loot').length
              return (
                <li key={key}>
                  <button className={focus === key ? 'active' : ''} onClick={() => onFocus(focus === key ? null : key)}>
                    <PathIcon bot={j.player.bot} />
                    <span className="pid">{j.player.bot ? `Bot ${j.player.id}` : shortId(j.player.id)}</span>
                    <span className={`outcome ${j.player.outcome}`}>{OUTCOME_LABEL[j.player.outcome]}</span>
                    <span className="muted">
                      ⌖{kills} ▪{loot}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
    </aside>
  )
}
