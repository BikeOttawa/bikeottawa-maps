import { useI18n } from '../i18n'
import { StopIcon } from './StopIcon'

/** Map control, while a route is shown: its stop signs, traffic lights, barriers and roadwork on or off. */
export function RouteStopsSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  const { t } = useI18n()
  return (
    <button
      type="button"
      className="route-stops-button"
      aria-label={t('routeStops')}
      title={t('routeStops')}
      aria-pressed={on}
      onClick={() => onChange(!on)}
    >
      <StopIcon kind="light" />
    </button>
  )
}
