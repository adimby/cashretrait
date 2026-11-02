import { useState } from 'preact/hooks'
import { t } from '../i18n'
import { shareDetailed } from '../share'
import { Icon } from './Icon'

/** Opens the phone's share sheet, or copies the text when there is none. */
export function ShareButton({ text }: { text: () => string }) {
  const [msg, setMsg] = useState('')
  const onClick = async () => {
    setMsg('')
    const r = await shareDetailed(text())
    setMsg(r === 'copied' ? t('share.copied') : r === 'failed' ? t('share.failed') : '')
  }
  return (
    <div class="action">
      <button type="button" class="btn btn-action" onClick={onClick}>
        <Icon name="share" size={20} />{t('action.share')}
      </button>
      <p class={`action-msg${msg === t('share.failed') ? ' is-error' : ''}`} role="status">{msg}</p>
    </div>
  )
}
