import { signal } from '@preact/signals'
import { loadTariffs } from './tariffs'

export const tariffsError = signal(false)

export async function retryTariffs(): Promise<void> {
  tariffsError.value = false
  try {
    await loadTariffs()
  } catch {
    tariffsError.value = true
  }
}
