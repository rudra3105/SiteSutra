'use client'

import { Alert } from '@/types'

const severityColors = { HIGH: 'border-red-800 bg-red-900/20', MEDIUM: 'border-yellow-800 bg-yellow-900/20', LOW: 'border-blue-800 bg-blue-900/10' }
const severityText = { HIGH: 'text-red-400', MEDIUM: 'text-yellow-400', LOW: 'text-blue-400' }

export function AlertsList({ alerts }: { alerts: Alert[] }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.485 3.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 3.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
        Site Alerts
      </h2>
      <div className="space-y-2">
        {alerts.map(alert => (
          <div key={alert.id} className={`border rounded-xl p-3 flex items-start gap-3 ${severityColors[alert.severity]}`}>
            <span className={`text-xs font-bold uppercase mt-0.5 flex-shrink-0 ${severityText[alert.severity]}`}>{alert.severity}</span>
            <div>
              <p className="text-slate-800 text-sm font-medium">{alert.siteName}</p>
              <p className="text-slate-600 text-xs">{alert.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
