import { useI18n } from '../i18n'
import { AddPlaceIcon } from './icons'

/** Map control, on the places layer: a pin for a place that is missing, where the map is looking. */
export function AddPlaceButton({ onClick }: { onClick: () => void }) {
  const { t } = useI18n()
  return (
    <button type="button" className="add-place-button" aria-label={t('add')} title={t('add')} onClick={onClick}>
      <AddPlaceIcon />
    </button>
  )
}
