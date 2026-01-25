export interface UserPreferences {
  babyBirthDate: string;
  babyName: string;
  location: {
    lat: number;
    lng: number;
    name: string;
  };
  recurringTasks: string[];
  feedingTimes: string[];    // e.g., ['8:00 AM', '12:00 PM', '4:00 PM']
  napsPerDay: number;        // e.g., 2
  napDuration: number;       // minutes, e.g., 30
}

// Parsed appointment from free text
export interface ParsedAppointment {
  description: string;
  startTime?: string;      // e.g., "1:00 PM"
  endTime?: string;        // e.g., "4:00 PM"
  startMins?: number;      // minutes since midnight for easy comparison
  endMins?: number;
  type: 'outing' | 'visitor' | 'appointment' | 'other';
  fulfillsTask?: string;   // e.g., "Going for a walk" if walking with friend
}

export interface DailySurvey {
  date: string;
  energyLevel: 'low' | 'medium' | 'high';
  stayingHome: boolean;
  wantsCrafts: boolean;
  activityMoods: string[];  // e.g., ['messy', 'active', 'quiet', 'social', 'educational']
  focusAreas: string[];
  freeTimeWindows: string[];
  appointments?: string;
  parsedAppointments?: ParsedAppointment[];  // Structured version parsed from text
}

export interface AppState {
  firstUseDate: string;
  calendarReminderShown: boolean;
  calendarReminderResponse?: 'yes' | 'no' | 'later';
}

export interface Activity {
  id: string;
  title: string;
  description: string;
  duration: number;
  energyRequired: 'low' | 'medium' | 'high';
  indoor: boolean;
  category: 'sensory' | 'motor' | 'cognitive' | 'social' | 'creative';
  ageRange: { min: number; max: number };
  materials?: string[];
  weatherDependent?: 'good' | 'bad' | 'any';
  tags: string[];
}

export type TimeBlock = 'morning' | 'midday' | 'afternoon' | 'evening';

export interface ChecklistItem {
  id: string;
  task: string;
  completed: boolean;
  type: 'recurring' | 'bonus' | 'feeding' | 'nap';
  activity?: Activity;
  time?: string;  // For scheduled items like feeds
  timeBlock?: TimeBlock;  // Suggested time block for the activity
  suggestedTime?: string;  // More specific suggested time like "9:30 AM"
  canOverlap?: boolean;  // Can be done while doing something else (e.g., music during visitor)
  isEdited?: boolean;  // User has manually edited this item
  socialActivity?: boolean;  // Good for when visitors are over
}

export interface DailyChecklist {
  date: string;
  items: ChecklistItem[];
  surveyCompleted: boolean;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  isRainy: boolean;
  isGoodWeather: boolean;
  description: string;
}

export interface MelbourneVenue {
  id: string;
  name: string;
  type: 'library' | 'park' | 'museum' | 'attraction' | 'farm' | 'playgroup' | 'beach' | 'market' | 'playcentre' | 'zoo' | 'walk';
  area: string;
  address: string;
  description: string;
  babyFriendly: string[];
  schedule: {
    recurring: string;
    time: string;
  } | null;
  ageRange: { min: number; max: number };
  indoor: boolean;
  free: boolean;
  url: string | null;
}

export interface DailyFeedback {
  date: string;
  whatWorked: string[];
  whatDidntWork: string[];
  notes: string;
  suggestedVenue?: string;
}

export interface VenueSuggestion {
  name: string;
  type: string;
  area: string;
  notes: string;
  submittedAt: string;
}
