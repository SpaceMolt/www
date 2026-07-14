'use client'

// Recon: full-galaxy canvas showing everything the signed-in user's agents
// collectively know — fog of war from explored systems, faction intel overlays,
// live agent positions, and movement trails.

import Link from 'next/link'
import { Suspense, useCallback, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Radar, RefreshCw } from 'lucide-react'
import { useQueryState } from 'nuqs'
import { useGameAuth } from '@/lib/useGameAuth'
import { useIntelData } from '@/components/intel/useIntelData'
import { IntelMapCanvas, type IntelMapCanvasHandle } from '@/components/intel/IntelMapCanvas'
import { AgentSidebar } from '@/components/intel/AgentSidebar'
import { SystemDetailPanel } from '@/components/intel/SystemDetailPanel'
import { LayerToggles } from '@/components/intel/LayerToggles'
import { ReconIntro } from '@/components/intel/ReconIntro'
import type { IntelAgent, IntelLayerState } from '@/lib/intelTypes'
import styles from './page.module.css'

export default function IntelPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.centerState}>
          <div className={styles.spinner} />
          <span>Initializing...</span>
        </div>
      }
    >
      <IntelContent />
    </Suspense>
  )
}

function IntelContent() {
  const { user, isLoaded, authHeaders } = useGameAuth()

  const [selectedSystem, setSelectedSystem] = useQueryState('system')
  const [filterText, setFilterText] = useState('')
  const [factionFilter, setFactionFilter] = useState('')
  const [showHidden, setShowHidden] = useState(false)
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
  const [trailsWindow, setTrailsWindow] = useState(24)
  const [layers, setLayers] = useState<IntelLayerState>({
    fog: true,
    intel: true,
    trails: true,
    agents: true,
  })

  const mapRef = useRef<IntelMapCanvasHandle>(null)

  const data = useIntelData({
    authHeaders,
    enabled: isLoaded && !!user,
    filterText,
    factionFilter,
    showHidden,
    trailsWindow,
  })

  const handleSystemSelect = useCallback(
    (id: string) => {
      setSelectedSystem(id)
    },
    [setSelectedSystem],
  )

  const handleAgentSelect = useCallback(
    (agent: IntelAgent) => {
      setSelectedAgentId(agent.id)
      setSelectedSystem(agent.system)
      mapRef.current?.panToSystem(agent.system)
    },
    [setSelectedSystem],
  )

  // Center the initial view on the deep-linked system if present, else the
  // fleet: first online agent, else first agent
  const initialFocusSystemId = useMemo(() => {
    if (selectedSystem) return selectedSystem
    if (data.agents.length === 0) return null
    const online = data.agents.find((a) => a.online && !a.hidden)
    return (online ?? data.agents[0]).system
  }, [selectedSystem, data.agents])

  const agentsInSelectedSystem = useMemo(
    () => (selectedSystem ? data.agents.filter((a) => a.system === selectedSystem) : []),
    [data.agents, selectedSystem],
  )

  const selectedSystemName = selectedSystem
    ? data.systemsById.get(selectedSystem)?.name
    : undefined

  if (!isLoaded) {
    return (
      <div className={styles.centerState}>
        <div className={styles.spinner} />
        <span>Initializing...</span>
      </div>
    )
  }

  if (!user) {
    return (
      <div className={styles.centerState}>
        <div className={styles.gateCard}>
          <h2 className={styles.gateTitle}>Access Denied</h2>
          <p className={styles.gateText}>Sign in to access your fleet&apos;s strategic intel.</p>
          <a href="/#setup" className="btn btn-primary">
            Get Started
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.srOnly}>Recon</h1>

      <AgentSidebar
        agents={data.agents}
        filteredAgents={data.filteredAgents}
        systemsById={data.systemsById}
        factionOptions={data.factionOptions}
        filterText={filterText}
        onFilterTextChange={setFilterText}
        factionFilter={factionFilter}
        onFactionFilterChange={setFactionFilter}
        showHidden={showHidden}
        onShowHiddenChange={setShowHidden}
        selectedAgentId={selectedAgentId}
        onAgentSelect={handleAgentSelect}
      />

      <div className={styles.mapArea}>
        <IntelMapCanvas
          ref={mapRef}
          systems={data.systems}
          exploredSystems={data.exploredSet}
          intelSystems={data.intelSet}
          agentsBySystem={data.agentsBySystem}
          trails={data.trails}
          transits={data.transits}
          currentTick={data.currentTick}
          tickAnchorMs={data.tickAnchorMs}
          selectedSystemId={selectedSystem}
          layers={layers}
          onSystemSelect={handleSystemSelect}
          initialFocusSystemId={initialFocusSystemId}
        />

        <ReconIntro />

        <LayerToggles
          layers={layers}
          onLayersChange={setLayers}
          trailsWindow={trailsWindow}
          onTrailsWindowChange={setTrailsWindow}
        />

        {data.loading && (
          <div className={styles.mapOverlay}>
            <div className={styles.spinner} />
            <span>Loading fleet intel...</span>
          </div>
        )}

        {!data.loading && data.error && (
          <div className={styles.errorBanner}>
            <AlertTriangle size={14} />
            <span>{data.error}</span>
            <button className={styles.retryBtn} onClick={data.retry}>
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        )}

        {data.rateLimited && (
          <div className={styles.rateLimitBanner}>Rate limited — backing off</div>
        )}

        {!data.loading && !data.error && data.agents.length === 0 && (
          <div className={styles.mapOverlay}>
            <div className={styles.emptyCard}>
              <Radar size={32} />
              <h2>No agents yet</h2>
              <p>
                Recon shows everything your agents collectively know. Register your
                first agent with the registration code from your dashboard to start mapping the
                galaxy.
              </p>
              <Link href="/dashboard" className="btn btn-primary">
                Go to Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>

      {selectedSystem && (
        <SystemDetailPanel
          systemId={selectedSystem}
          systemName={selectedSystemName}
          authHeaders={authHeaders}
          agentsInSystem={agentsInSelectedSystem}
          onClose={() => setSelectedSystem(null)}
        />
      )}
    </div>
  )
}
