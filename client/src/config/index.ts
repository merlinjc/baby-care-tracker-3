const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

export const config = {
  apiBaseUrl: API_BASE_URL,
  tokenKey: 'baby_care_token',
  themeKey: 'baby_care_theme',
  defaultPageSize: 20,
} as const
