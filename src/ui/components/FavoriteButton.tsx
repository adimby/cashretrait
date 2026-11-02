import { useState } from 'preact/hooks'
import { t } from '../i18n'
import { addFavorite, findFavorite, removeFavorite, favorites, type CalcMode, type FavParams } from '../state/favorites'
import { Icon } from './Icon'

/** Toggles the current calculation in the favorites (aria-pressed shows the state). */
export function FavoriteButton({ mode, params, label }: { mode: CalcMode; params: FavParams; label: string }) {
  void favorites.value // subscribe
  const fav = findFavorite(mode, params)
  const [msg, setMsg] = useState('')
  const onClick = () => {
    if (fav) { removeFavorite(fav.id); setMsg(t('fav.removed')) } else { addFavorite({ label, mode, params }); setMsg(t('fav.added')) }
  }
  return (
    <div class="action">
      <button type="button" class={`btn btn-action${fav ? ' is-on' : ''}`} aria-pressed={!!fav} aria-label={t('fav.aria')} onClick={onClick}>
        <Icon name="star" size={20} filled={!!fav} />{fav ? t('fav.saved') : t('fav.add')}
      </button>
      <p class="action-msg" role="status">{msg}</p>
    </div>
  )
}
