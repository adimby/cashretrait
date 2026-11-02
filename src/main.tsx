import { render } from 'preact'
import './ui/styles/app.css'
import { App } from './ui/App'
import { startRouter } from './ui/state/route'
import './ui/state/settings'
import { retryTariffs } from './ui/state/boot'

startRouter()
render(<App />, document.getElementById('app')!)
void retryTariffs()
