import Store from 'electron-store'
import type { AppSettings, PipelineSettings } from '../shared/types'
import { DEFAULT_SETTINGS, DEFAULT_PIPELINE_SETTINGS } from '../shared/types'

const store = new Store<AppSettings>({
  name: 'docmind-settings',
  defaults: DEFAULT_SETTINGS,
})

export function getSetting<K extends keyof AppSettings>(key: K): AppSettings[K] {
  return store.get(key)
}

export function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  store.set(key, value)
}

export function getAllSettings(): AppSettings {
  return store.store
}

export function getPipelineSettings(): PipelineSettings {
  return store.get('pipeline') ?? DEFAULT_PIPELINE_SETTINGS
}

export function setPipelineSetting<K extends keyof PipelineSettings>(
  key: K,
  value: PipelineSettings[K],
): void {
  const current = getPipelineSettings()
  store.set('pipeline', { ...current, [key]: value })
}
