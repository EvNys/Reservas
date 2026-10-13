const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseEnabled = Object.values(config).every(Boolean)
export const companyId = import.meta.env.VITE_COMPANY_ID || 'empresa-demo'
export const whatsappNumber = import.meta.env.VITE_WHATSAPP_NUMBER || ''
export const firebaseConfig = config
