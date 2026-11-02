import { render } from 'preact'
import './ui/styles/app.css'
import { App } from './ui/App'
import { startRouter } from './ui/state/route'
import './ui/state/settings'
import { retryTariffs } from './ui/state/boot'
import { tariffs, tariffsStale } from './ui/state/tariffs'

startRouter()
render(<App />, document.getElementById('app')!)
void retryTariffs()
// Back online with old or missing tariffs: try again.
addEventListener('online', () => { if (tariffsStale.value || !tariffs.value) void retryTariffs() })
