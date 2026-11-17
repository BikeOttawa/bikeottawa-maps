import type { ReactNode } from 'react'
import { useI18n } from '../i18n'

/** A layer's how-to and source, folded under one line so the legend stays short. */
export function LegendNote({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  return (
    <details className="legend-note">
      <summary>{t('legendNote')}</summary>
      {children}
    </details>
  )
}
