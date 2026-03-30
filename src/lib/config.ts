import configData from '../../care-config.json'

export interface ConditionConfig {
  name: string
  category: string
  color: string
  emoji: string
}

export interface AppConfig {
  app_name: string
  patient_label: string
  conditions: ConditionConfig[]
  extra_categories: string[]
  google_drive_folder_id: string
}

export const config: AppConfig = configData as AppConfig

// Derived helpers
export const ALL_CATEGORIES = [
  'General',
  ...config.conditions.map(c => c.category),
  'Referral',
  'WhatsApp Chat',
  ...config.extra_categories,
]

export const CONDITION_BY_CATEGORY: Record<string, ConditionConfig> = {}
for (const c of config.conditions) {
  CONDITION_BY_CATEGORY[c.category] = c
}

// Color mappings for Tailwind — must be static strings for Tailwind to pick them up
const COLOR_MAP: Record<string, { header: string; bg: string; text: string; badge: string; border: string }> = {
  blue: {
    header: 'from-blue-600 to-blue-700',
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    badge: 'bg-blue-100 text-blue-700',
    border: 'border-blue-200',
  },
  pink: {
    header: 'from-pink-600 to-pink-700',
    bg: 'bg-pink-50',
    text: 'text-pink-700',
    badge: 'bg-pink-100 text-pink-700',
    border: 'border-pink-200',
  },
  green: {
    header: 'from-green-600 to-green-700',
    bg: 'bg-green-50',
    text: 'text-green-700',
    badge: 'bg-green-100 text-green-700',
    border: 'border-green-200',
  },
  purple: {
    header: 'from-purple-600 to-purple-700',
    bg: 'bg-purple-50',
    text: 'text-purple-700',
    badge: 'bg-purple-100 text-purple-700',
    border: 'border-purple-200',
  },
  orange: {
    header: 'from-orange-600 to-orange-700',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    badge: 'bg-orange-100 text-orange-700',
    border: 'border-orange-200',
  },
  red: {
    header: 'from-red-600 to-red-700',
    bg: 'bg-red-50',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700',
    border: 'border-red-200',
  },
  teal: {
    header: 'from-teal-600 to-teal-700',
    bg: 'bg-teal-50',
    text: 'text-teal-700',
    badge: 'bg-teal-100 text-teal-700',
    border: 'border-teal-200',
  },
  gray: {
    header: 'from-gray-600 to-gray-700',
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    badge: 'bg-gray-100 text-gray-700',
    border: 'border-gray-200',
  },
}

export function getColorScheme(color: string) {
  return COLOR_MAP[color] || COLOR_MAP.gray
}

// Category badge colors for timeline, log, etc.
export const CATEGORY_COLORS: Record<string, string> = {
  General: 'bg-gray-100 text-gray-700',
  Admin: 'bg-yellow-100 text-yellow-700',
  Logistics: 'bg-purple-100 text-purple-700',
  Referral: 'bg-indigo-100 text-indigo-700',
  'WhatsApp Chat': 'bg-green-100 text-green-700',
}
// Add condition categories
for (const c of config.conditions) {
  CATEGORY_COLORS[c.category] = `${COLOR_MAP[c.color]?.badge || 'bg-gray-100 text-gray-700'}`
}
