/**
 * Health Dashboard UI - Real-time System Status
 * Shows all services, metrics, and systemd timers
 */
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'System Health - Vinops',
  description: 'Real-time system health monitoring dashboard',
  robots: 'noindex, nofollow',
}

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

async function getHealthData() {
  try {
    // Fetch from same host to avoid CORS
    const res = await fetch('http://localhost:3000/health', {
      cache: 'no-store',
      headers: { 'Accept': 'application/json' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (e) {
    console.error('Health fetch error:', e)
    return null
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors = {
    up: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
    healthy: 'bg-green-500',
    unhealthy: 'bg-red-500',
  }
  const color = colors[status as keyof typeof colors] || 'bg-gray-500'

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium text-white ${color}`}>
      {status.toUpperCase()}
    </span>
  )
}

function ServiceCard({ name, service }: { name: string; service: any }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold text-gray-900">{name}</h3>
        <StatusBadge status={service.status} />
      </div>
      <p className="text-sm text-gray-600">{service.message}</p>
      {service.lastRun && (
        <p className="text-xs text-gray-500 mt-2">
          Last run: {new Date(service.lastRun).toLocaleString()}
        </p>
      )}
      {service.nextRun && (
        <p className="text-xs text-gray-500">
          Next run: {new Date(service.nextRun).toLocaleString()}
        </p>
      )}
      {service.total !== undefined && (
        <p className="text-xs text-gray-500 mt-2">
          Total: {service.total.toLocaleString()}
        </p>
      )}
      {service.lastAdded && (
        <p className="text-xs text-gray-500">
          Last added: {new Date(service.lastAdded).toLocaleString()}
        </p>
      )}
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <p className="text-sm text-blue-600 font-medium">{label}</p>
      <p className="text-2xl font-bold text-blue-900 mt-1">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

export default async function HealthPage() {
  const health = await getHealthData()

  if (!health) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white border border-red-200 rounded-lg p-8 max-w-md">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Health Check Failed</h1>
          <p className="text-gray-700">Unable to fetch system health data. The service may be down.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
            <StatusBadge status={health.status} />
          </div>
          <p className="text-sm text-gray-600">
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard label="Total Vehicles" value={health.metrics.totalVehicles} />
          <MetricCard label="Total Lots" value={health.metrics.totalLots} />
          <MetricCard label="Active Lots" value={health.metrics.activeLots} />
          <MetricCard label="Vehicles with Images" value={health.metrics.vehiclesWithImages} />
        </div>

        {/* Services Grid */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Services</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ServiceCard name="Web Server" service={health.services.web} />
            <ServiceCard name="Database" service={health.services.database} />
            <ServiceCard name="Redis Cache" service={health.services.redis} />
            <ServiceCard name="ETL Pipeline" service={health.services.etl} />
            {health.services.imageBackfill && (
              <ServiceCard name="Image Backfill" service={health.services.imageBackfill} />
            )}
            <ServiceCard name="Images" service={health.services.images} />
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Uptime</p>
              <p className="font-medium">{Math.floor(health.metrics.uptimeSeconds / 60)} minutes</p>
            </div>
            <div>
              <p className="text-gray-500">Image Coverage</p>
              <p className="font-medium">
                {health.metrics.totalVehicles > 0
                  ? ((health.metrics.vehiclesWithImages / health.metrics.totalVehicles) * 100).toFixed(1)
                  : 0}%
              </p>
            </div>
            <div>
              <p className="text-gray-500">API Endpoint</p>
              <p className="font-medium text-xs"><code>/health</code></p>
            </div>
            <div>
              <p className="text-gray-500">Environment</p>
              <p className="font-medium">Production</p>
            </div>
          </div>
        </div>

        {/* Refresh Note */}
        <div className="mt-4 text-center text-xs text-gray-500">
          <p>This page updates on every refresh. Auto-refresh every 30 seconds recommended.</p>
        </div>
      </div>
    </div>
  )
}
