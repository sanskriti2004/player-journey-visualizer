import { useEffect, useMemo, useRef, useState } from 'react'
import { formatClock, formatDay, formatStartTime, shortId } from '../lib/format'
import type { MapInfo, MatchSummary } from '../types'

type SortKey = 'recent' | 'duration' | 'kills' | 'deaths' | 'bots'

const SORTS: Record<SortKey, { label: string; fn: (a: MatchSummary, b: MatchSummary) => number }> = {
  recent: { label: 'Most recent', fn: (a, b) => b.startedAt - a.startedAt },
  duration: { label: 'Longest', fn: (a, b) => b.duration - a.duration },
  kills: { label: 'Most kills', fn: (a, b) => b.kills - a.kills },
  deaths: { label: 'Most deaths', fn: (a, b) => b.deaths - a.deaths || b.stormDeaths - a.stormDeaths },
  bots: { label: 'Most bots tracked', fn: (a, b) => b.bots - a.bots },
}

interface Props {
  maps: MapInfo[]
  mapId: string
  matchCountByMap: Record<string, number>
  days: string[]
  selectedDays: string[]
  matches: MatchSummary[]
  matchId: string | null
  onMap: (id: string) => void
  onDays: (days: string[]) => void
  onMatch: (id: string | null) => void
}

export default function Sidebar({ maps, mapId, matchCountByMap, days, selectedDays, matches, matchId, onMap, onDays, onMatch }: Props) {
  const [sort, setSort] = useState<SortKey>('recent')
  const [query, setQuery] = useState('')
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    listRef.current?.querySelector('.match.active')?.scrollIntoView({ block: 'nearest' })
  }, [matchId])

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return matches.filter((m) => !q || m.id.toLowerCase().includes(q)).sort(SORTS[sort].fn)
  }, [matches, sort, query])

  const toggleDay = (d: string) =>
    onDays(selectedDays.includes(d) ? selectedDays.filter((x) => x !== d) : [...selectedDays, d].sort())

  return (
    <aside className="sidebar">
      <section>
        <h2>Map</h2>
        <div className="segmented">
          {maps.map((m) => (
            <button key={m.id} className={m.id === mapId ? 'active' : ''} onClick={() => onMap(m.id)}>
              {m.name}
              <small>{matchCountByMap[m.id] ?? 0}</small>
            </button>
          ))}
        </div>
      </section>

      <section>
        <h2>
          Date <span className="hint">{selectedDays.length ? `${selectedDays.length} selected` : 'all days'}</span>
        </h2>
        <div className="chips">
          {days.map((d) => (
            <button key={d} className={`chip ${selectedDays.includes(d) ? 'active' : ''}`} onClick={() => toggleDay(d)}>
              {formatDay(d)}
              {d === days[days.length - 1] && <em title="Data collection was still ongoing"> partial</em>}
            </button>
          ))}
          {selectedDays.length > 0 && (
            <button className="chip ghost" onClick={() => onDays([])}>
              Clear
            </button>
          )}
        </div>
      </section>

      <section className="match-section">
        <h2>
          Matches <span className="hint">{matches.length}</span>
        </h2>
        <div className="match-tools">
          <input type="search" placeholder="Search match ID" value={query} onChange={(e) => setQuery(e.target.value)} />
          <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort matches">
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
        <ul className="match-list" ref={listRef}>
          <li>
            <button className={`match all ${matchId === null ? 'active' : ''}`} onClick={() => onMatch(null)}>
              <div className="match-top">
                <strong>All matches</strong>
                <span className="muted">aggregate view</span>
              </div>
              <div className="match-meta">{matches.length} matches overlaid · best for heatmaps</div>
            </button>
          </li>
          {list.map((m) => (
            <li key={m.id}>
              <button className={`match ${m.id === matchId ? 'active' : ''}`} onClick={() => onMatch(m.id)}>
                <div className="match-top">
                  <code>{shortId(m.id)}</code>
                  <span className="muted">
                    {formatDay(m.day)} · {formatStartTime(m.startedAt)}
                  </span>
                </div>
                <div className="match-meta">
                  <span title="Match length">{formatClock(m.duration)}</span>
                  <span title="Human journeys">
                    <i className="dot human" />
                    {m.humans}
                  </span>
                  <span title="Bot journeys">
                    <i className="dot bot" />
                    {m.bots}
                  </span>
                  <span title="Kills">⌖ {m.kills}</span>
                  <span title="Deaths">✕ {m.deaths}</span>
                  {m.stormDeaths > 0 && <span className="storm" title="Storm deaths">◆ {m.stormDeaths}</span>}
                </div>
              </button>
            </li>
          ))}
          {list.length === 0 && <li className="empty">No matches for this filter.</li>}
        </ul>
      </section>
    </aside>
  )
}
