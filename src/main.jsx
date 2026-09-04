import React from 'react'
import ReactDOM from 'react-dom/client'
import * as Sentry from '@sentry/react'
import App from './App.jsx'
import './styles/global.css'
import posthog from 'posthog-js'

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN || 'https://ab6e01defbc67fe2aed88200a3a7f17a@o4512014304215040.ingest.us.sentry.io/4512014315028480'

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    integrations: [
      Sentry.replayIntegration(),
    ],
    // Session Replay sampling
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  })
}

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY || 'phc_yxWknb5sdCgMd7BgYAc8k8u39WaUGcYffqRmNxA5GMrq'
const POSTHOG_HOST = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'

if (POSTHOG_KEY) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    person_profiles: 'identified_only', // Recommended: only create profiles for signed-in users
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)


