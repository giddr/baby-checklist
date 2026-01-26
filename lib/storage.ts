import type { UserPreferences, DailySurvey, AppState, DailyChecklist, DailyFeedback, VenueSuggestion } from '@/types';

const STORAGE_KEYS = {
  USER_PREFERENCES: 'baby-checklist-preferences',
  APP_STATE: 'baby-checklist-app-state',
  DAILY_SURVEY: 'baby-checklist-survey',
  DAILY_CHECKLIST: 'baby-checklist-checklist',
  DAILY_FEEDBACK: 'baby-checklist-feedback',
  VENUE_SUGGESTIONS: 'baby-checklist-venue-suggestions',
} as const;

// Default values
const DEFAULT_PREFERENCES: UserPreferences = {
  babyBirthDate: '2025-06-15', // June 2025
  babyName: 'Baby',
  location: {
    lat: -37.8136,
    lng: 144.9631,
    name: 'Melbourne, Australia',
  },
  recurringTasks: [
    'Read 5 books',
    'Eating solids',
    'Going for a walk',
    'Having a bath',
    'Vestibular play',
    'Crawling/walking practice',
    'Music time',
  ],
  feedingTimes: ['8:00 AM', '12:00 PM', '4:00 PM', '7:30 PM'],
  napsPerDay: 2,
  napDuration: 30, // minutes
};

const DEFAULT_APP_STATE: AppState = {
  firstUseDate: new Date().toISOString().split('T')[0],
  calendarReminderShown: false,
};

// Helper to safely parse JSON from localStorage
function safeGetItem<T>(key: string, defaultValue: T): T {
  if (typeof window === 'undefined') return defaultValue;

  try {
    const item = localStorage.getItem(key);
    if (!item) return defaultValue;
    return JSON.parse(item) as T;
  } catch {
    return defaultValue;
  }
}

function safeSetItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
  }
}

// User Preferences
export function getPreferences(): UserPreferences {
  return safeGetItem(STORAGE_KEYS.USER_PREFERENCES, DEFAULT_PREFERENCES);
}

export function savePreferences(preferences: UserPreferences): void {
  safeSetItem(STORAGE_KEYS.USER_PREFERENCES, preferences);
}

export function updatePreferences(updates: Partial<UserPreferences>): UserPreferences {
  const current = getPreferences();
  const updated = { ...current, ...updates };
  savePreferences(updated);
  return updated;
}

// App State
export function getAppState(): AppState {
  const state = safeGetItem(STORAGE_KEYS.APP_STATE, DEFAULT_APP_STATE);
  // Ensure firstUseDate is set if missing
  if (!state.firstUseDate) {
    state.firstUseDate = new Date().toISOString().split('T')[0];
    saveAppState(state);
  }
  return state;
}

export function saveAppState(state: AppState): void {
  safeSetItem(STORAGE_KEYS.APP_STATE, state);
}

export function updateAppState(updates: Partial<AppState>): AppState {
  const current = getAppState();
  const updated = { ...current, ...updates };
  saveAppState(updated);
  return updated;
}

// Daily Survey
export function getTodaySurvey(): DailySurvey | null {
  const today = new Date().toISOString().split('T')[0];
  const survey = safeGetItem<DailySurvey | null>(STORAGE_KEYS.DAILY_SURVEY, null);

  if (survey && survey.date === today) {
    return survey;
  }
  return null;
}

export function saveSurvey(survey: DailySurvey): void {
  safeSetItem(STORAGE_KEYS.DAILY_SURVEY, survey);
}

// Daily Checklist
export function getTodayChecklist(): DailyChecklist | null {
  const today = new Date().toISOString().split('T')[0];
  const checklist = safeGetItem<DailyChecklist | null>(STORAGE_KEYS.DAILY_CHECKLIST, null);

  if (checklist && checklist.date === today) {
    return checklist;
  }
  return null;
}

export function saveChecklist(checklist: DailyChecklist): void {
  safeSetItem(STORAGE_KEYS.DAILY_CHECKLIST, checklist);
}

export function toggleChecklistItem(itemId: string): DailyChecklist | null {
  const checklist = getTodayChecklist();
  if (!checklist) return null;

  const updatedItems = checklist.items.map(item =>
    item.id === itemId ? { ...item, completed: !item.completed } : item
  );

  const updated = { ...checklist, items: updatedItems };
  saveChecklist(updated);
  return updated;
}

// Utility: Calculate baby's age in months
export function getBabyAgeMonths(): number {
  const preferences = getPreferences();
  const birthDate = new Date(preferences.babyBirthDate);
  const today = new Date();

  const months = (today.getFullYear() - birthDate.getFullYear()) * 12
    + (today.getMonth() - birthDate.getMonth());

  return Math.max(0, months);
}

// Utility: Check if calendar reminder should show
export function shouldShowCalendarReminder(): boolean {
  const state = getAppState();

  if (state.calendarReminderShown) return false;
  if (state.calendarReminderResponse) return false;

  const firstUse = new Date(state.firstUseDate);
  const today = new Date();
  const daysSinceFirstUse = Math.floor((today.getTime() - firstUse.getTime()) / (1000 * 60 * 60 * 24));

  return daysSinceFirstUse >= 30;
}

export function dismissCalendarReminder(response: 'yes' | 'no' | 'later'): void {
  updateAppState({
    calendarReminderShown: true,
    calendarReminderResponse: response,
  });
}

// Daily Feedback
export function getTodayFeedback(): DailyFeedback | null {
  const today = new Date().toISOString().split('T')[0];
  const feedback = safeGetItem<DailyFeedback | null>(STORAGE_KEYS.DAILY_FEEDBACK, null);

  if (feedback && feedback.date === today) {
    return feedback;
  }
  return null;
}

export function saveFeedback(feedback: DailyFeedback): void {
  safeSetItem(STORAGE_KEYS.DAILY_FEEDBACK, feedback);
}

// Venue Suggestions
export function getVenueSuggestions(): VenueSuggestion[] {
  return safeGetItem<VenueSuggestion[]>(STORAGE_KEYS.VENUE_SUGGESTIONS, []);
}

export function addVenueSuggestion(suggestion: Omit<VenueSuggestion, 'submittedAt'>): void {
  const suggestions = getVenueSuggestions();
  suggestions.push({
    ...suggestion,
    submittedAt: new Date().toISOString(),
  });
  safeSetItem(STORAGE_KEYS.VENUE_SUGGESTIONS, suggestions);
}
