export const CONSENT_STORAGE_KEY = 'pak-eco-analytics-consent';
export const COACH_STORAGE_KEY = 'pak-eco-coach-v1';

export function isConsentPending() {
  if (typeof window === 'undefined') return false;
  try {
    const value = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    return value !== 'accepted' && value !== 'declined';
  } catch {
    return false;
  }
}

export function isCoachPending() {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(COACH_STORAGE_KEY) !== '1';
  } catch {
    return false;
  }
}
