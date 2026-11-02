import { useEffect, useRef, useState } from 'preact/hooks'
import { t } from '../i18n'
import { favorites, openFavorite, removeFavorite, restoreFavorite, type Favorite } from '../state/favorites'
import { Icon } from '../components/Icon'
import { BackLink } from './Plus'

/** Plus › Favoris: open a saved calculation in Calculer, or delete it (with undo). */
export function Favorites() {
  const list = favorites.value
  const [removed, setRemoved] = useState<{ f: Favorite; index: number } | null>(null)
  const undoRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { if (removed) undoRef.current?.focus() }, [removed])

  const del = (f: Favorite, index: number) => {
    removeFavorite(f.id)
    setRemoved({ f, index })
  }

  return (
    <section class="screen" aria-labelledby="screen-title">
      <BackLink />
      <h1 id="screen-title" class="screen-title" tabIndex={-1}>{t('favoris.title')}</h1>

      <div class="fav-undo" role="status">
        {removed && (
          <>
            <p>{t('fav.deleted', { label: removed.f.label })}</p>
            <button ref={undoRef} type="button" class="btn btn-outline"
              onClick={() => { restoreFavorite(removed.f, removed.index); setRemoved(null) }}>
              {t('fav.undo')}
            </button>
          </>
        )}
      </div>

      {list.length ? (
        <>
          <p class="lead">{t('favoris.intro')}</p>
          <ul class="board-list fav-list">
            {list.map((f, i) => (
              <li key={f.id} class="fav-row">
                <button type="button" class="board-row fav-open" onClick={() => openFavorite(f)}>
                  <span class="board-row-icon"><Icon name="star" filled /></span>
                  <span class="board-row-text">
                    <span class="board-row-title">{f.label}</span>
                    <span class="board-row-desc">{t('fav.open')}</span>
                  </span>
                  <span class="board-row-end"><Icon name="chevron" /></span>
                </button>
                <button type="button" class="fav-del" aria-label={t('fav.delete.aria', { label: f.label })} onClick={() => del(f, i)}>
                  <Icon name="trash" size={22} />
                  <span aria-hidden="true">{t('fav.delete')}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div class="empty">
          <span class="empty-icon"><Icon name="star" size={28} /></span>
          <p>{t('fav.empty')}</p>
          <a class="btn btn-solid" href="#/calculer"><Icon name="calculer" size={20} />{t('fav.goCalc')}</a>
        </div>
      )}
    </section>
  )
}
