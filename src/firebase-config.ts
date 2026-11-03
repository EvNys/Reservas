const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  storageBucket,
}

export const firebaseEnabled = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId)
export const storageEnabled = firebaseEnabled && Boolean(storageBucket)
export const companyId = import.meta.env.VITE_COMPANY_ID || 'empresa-demo'
export const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || ''
export const firebaseConfig = config
