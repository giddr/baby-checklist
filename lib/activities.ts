import type { Activity, DailySurvey, WeatherData, ChecklistItem, TimeBlock, ParsedAppointment } from '@/types';
import activitiesData from '@/data/activities.json';
import { getBabyAgeMonths, getPreferences } from './storage';

const activities = activitiesData as Activity[];

// Helper to parse time string like "8:00 AM" or "1pm" or "14:00" to minutes since midnight
function parseTimeToMinutes(time: string): number {
  // Try standard format first: "8:00 AM"
  let match = time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match) {
    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const isPM = match[3].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }

  // Try simple format: "1pm" or "1 pm"
  match = time.match(/(\d{1,2})\s*(AM|PM)/i);
  if (match) {
    let hours = parseInt(match[1]);
    const isPM = match[2].toUpperCase() === 'PM';
    if (isPM && hours !== 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return hours * 60;
  }

  // Try 24-hour format: "14:00"
  match = time.match(/(\d{1,2}):(\d{2})(?!\s*[AP])/i);
  if (match) {
    const hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    return hours * 60 + minutes;
  }

  // Try just hour: "at 2" (assume PM if between 1-6, AM otherwise)
  match = time.match(/(?:at\s+)?(\d{1,2})(?:\s|$|,)/i);
  if (match) {
    let hours = parseInt(match[1]);
    if (hours >= 1 && hours <= 6) hours += 12; // Assume afternoon
    return hours * 60;
  }

  return 0;
}

// Helper to convert minutes since midnight to time string
function minutesToTimeString(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  const isPM = hours >= 12;
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${isPM ? 'PM' : 'AM'}`;
}

// Determine time block from minutes since midnight
function getTimeBlock(mins: number): TimeBlock {
  if (mins < 720) return 'morning'; // Before noon
  if (mins < 840) return 'midday'; // Noon to 2pm
  if (mins < 1020) return 'afternoon'; // 2pm to 5pm
  return 'evening'; // 5pm onwards
}

// Parse free-text appointments into structured data
export function parseAppointments(text: string): ParsedAppointment[] {
  if (!text || !text.trim()) return [];

  const appointments: ParsedAppointment[] = [];

  // Split by common delimiters: comma, semicolon, newline, "and"
  const parts = text.split(/[,;\n]|(?:\s+and\s+)/i).filter(p => p.trim());

  for (const part of parts) {
    const trimmed = part.trim().toLowerCase();
    if (!trimmed) continue;

    const appointment: ParsedAppointment = {
      description: part.trim(),
      type: 'other',
    };

    // Detect type based on keywords
    if (/walk|stroll|park|outside/i.test(trimmed)) {
      appointment.type = 'outing';
      appointment.fulfillsTask = 'Going for a walk';
    } else if (/visit|friend|coming over|guest|playdate|play date|someone.*over/i.test(trimmed)) {
      appointment.type = 'visitor';
    } else if (/doctor|appointment|checkup|check-up|clinic|hospital/i.test(trimmed)) {
      appointment.type = 'appointment';
    } else if (/library|cafe|coffee|lunch|brunch|shopping|errand|museum|zoo/i.test(trimmed)) {
      appointment.type = 'outing';
    }

    // Extract time - look for patterns like "at 1pm", "1pm", "from 2-4", "2-4pm", "2 to 4"
    // Single time: "at 1pm", "1pm", "at 1"
    const singleTimeMatch = trimmed.match(/(?:at\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

    // Time range: "from 2-4", "2-4pm", "2 to 4", "between 2 and 4"
    const rangeMatch = trimmed.match(/(?:from\s+)?(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s*(?:-|to|until|til)\s*(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);

    if (rangeMatch) {
      const startTimeStr = rangeMatch[1];
      let endTimeStr = rangeMatch[2];

      // If end time has no am/pm but start does, or infer pm for afternoon times
      if (!/am|pm/i.test(endTimeStr) && /pm/i.test(startTimeStr)) {
        endTimeStr += ' PM';
      } else if (!/am|pm/i.test(endTimeStr)) {
        // Infer PM for typical afternoon times (1-7)
        const endHour = parseInt(endTimeStr);
        if (endHour >= 1 && endHour <= 7) {
          endTimeStr += ' PM';
        }
      }

      appointment.startMins = parseTimeToMinutes(startTimeStr);
      appointment.endMins = parseTimeToMinutes(endTimeStr);
      appointment.startTime = minutesToTimeString(appointment.startMins);
      appointment.endTime = minutesToTimeString(appointment.endMins);
    } else if (singleTimeMatch) {
      const timeStr = singleTimeMatch[1];
      appointment.startMins = parseTimeToMinutes(timeStr);
      appointment.startTime = minutesToTimeString(appointment.startMins);
      // Estimate end time based on type
      const durationMins = appointment.type === 'appointment' ? 60 : 90;
      appointment.endMins = appointment.startMins + durationMins;
      appointment.endTime = minutesToTimeString(appointment.endMins);
    }

    appointments.push(appointment);
  }

  return appointments;
}

// Check if a time slot conflicts with any appointments
function conflictsWithAppointments(startMins: number, endMins: number, appointments: ParsedAppointment[]): boolean {
  for (const apt of appointments) {
    if (apt.startMins !== undefined && apt.endMins !== undefined) {
      // Check for overlap
      if (startMins < apt.endMins && endMins > apt.startMins) {
        return true;
      }
    }
  }
  return false;
}

// Find a good time slot that doesn't conflict with appointments
function findAvailableSlot(
  preferredMins: number,
  duration: number,
  appointments: ParsedAppointment[],
  scheduledTimes: Array<{ start: number; end: number }>,
  minTime: number = 480, // 8am
  maxTime: number = 1080 // 6pm
): number {
  // Try preferred time first
  if (!conflictsWithAppointments(preferredMins, preferredMins + duration, appointments)) {
    const hasConflict = scheduledTimes.some(
      s => preferredMins < s.end && (preferredMins + duration) > s.start
    );
    if (!hasConflict) return preferredMins;
  }

  // Search for available slot in 30-minute increments
  for (let mins = minTime; mins <= maxTime - duration; mins += 30) {
    if (!conflictsWithAppointments(mins, mins + duration, appointments)) {
      const hasConflict = scheduledTimes.some(
        s => mins < s.end && (mins + duration) > s.start
      );
      if (!hasConflict) return mins;
    }
  }

  // Fallback to preferred time
  return preferredMins;
}

interface SelectionContext {
  survey: DailySurvey;
  weather: WeatherData | null;
  babyAgeMonths: number;
}

// Score an activity based on how well it matches the context
function scoreActivity(activity: Activity, context: SelectionContext): number {
  const { survey, weather, babyAgeMonths } = context;
  let score = 50; // Base score

  // Age filter (strict - must be in range)
  if (babyAgeMonths < activity.ageRange.min || babyAgeMonths > activity.ageRange.max) {
    return 0; // Disqualify
  }

  // Weather matching
  if (weather) {
    if (!activity.indoor && weather.isRainy) {
      return 0; // Can't do outdoor activity in rain
    }
    if (!activity.indoor && !survey.stayingHome && weather.isGoodWeather) {
      score += 20; // Boost outdoor activities on nice days when going out
    }
    if (activity.weatherDependent === 'good' && !weather.isGoodWeather) {
      score -= 30; // Penalize good-weather activities on bad days
    }
  }

  // Indoor/outdoor preference
  if (survey.stayingHome && !activity.indoor) {
    return 0; // Can't do outdoor if staying home
  }
  if (!survey.stayingHome && !activity.indoor) {
    score += 15; // Boost outdoor when going out
  }

  // Energy level matching
  if (survey.energyLevel === 'low') {
    if (activity.energyRequired === 'high') {
      score -= 40; // Significant penalty for high-energy on low-energy days
    } else if (activity.energyRequired === 'low') {
      score += 20; // Boost low-energy activities
    }
  } else if (survey.energyLevel === 'high') {
    if (activity.energyRequired === 'high') {
      score += 15; // Boost high-energy activities
    }
  }

  // Crafts/creative preference
  if (survey.wantsCrafts && activity.category === 'creative') {
    score += 30; // Big boost for creative activities when wanted
  }
  if (survey.wantsCrafts && activity.tags.includes('messy')) {
    score += 10; // Also boost messy activities
  }

  // Duration based on appointments (busy day = shorter activities)
  if (survey.appointments && survey.appointments.length > 0) {
    if (activity.duration <= 15) {
      score += 15; // Prefer shorter activities on busy days
    } else if (activity.duration >= 30) {
      score -= 10; // Penalize longer activities
    }
  }

  // Add some randomness to avoid same activities every day
  score += Math.random() * 20;

  return Math.max(0, score);
}

// Pick diverse activities from different categories
function pickDiverseActivities(scored: Array<{ activity: Activity; score: number }>, count: number): Activity[] {
  const selected: Activity[] = [];
  const usedCategories = new Set<string>();

  // Sort by score descending
  const sorted = [...scored].sort((a, b) => b.score - a.score);

  // First pass: try to get different categories
  for (const { activity } of sorted) {
    if (selected.length >= count) break;

    if (!usedCategories.has(activity.category)) {
      selected.push(activity);
      usedCategories.add(activity.category);
    }
  }

  // Second pass: fill remaining slots with highest scoring
  for (const { activity } of sorted) {
    if (selected.length >= count) break;

    if (!selected.includes(activity)) {
      selected.push(activity);
    }
  }

  return selected;
}

// Activities to exclude from bonus selection because they overlap with recurring tasks
const EXCLUDED_BONUS_PATTERNS = [
  /walk/i,      // "Going for a walk" is a recurring task
  /stroll/i,    // Also walking
  /bath/i,      // "Having a bath" is a recurring task
];

// Check if an activity overlaps with recurring tasks
function overlapsWithRecurringTasks(activity: Activity): boolean {
  const titleAndTags = activity.title + ' ' + activity.tags.join(' ');
  return EXCLUDED_BONUS_PATTERNS.some(pattern => pattern.test(titleAndTags));
}

// Main function to select bonus activities
export function selectBonusActivities(
  survey: DailySurvey,
  weather: WeatherData | null,
  count: number = 3
): Activity[] {
  const babyAgeMonths = getBabyAgeMonths();

  const context: SelectionContext = {
    survey,
    weather,
    babyAgeMonths,
  };

  // Score all activities, excluding those that overlap with recurring tasks
  const scored = activities
    .filter(activity => !overlapsWithRecurringTasks(activity)) // Filter out walk/bath activities
    .map(activity => ({
      activity,
      score: scoreActivity(activity, context),
    }))
    .filter(({ score }) => score > 0); // Remove disqualified

  return pickDiverseActivities(scored, count);
}

// Generate the full checklist for today with time-based planning
export function generateChecklist(
  survey: DailySurvey,
  weather: WeatherData | null
): ChecklistItem[] {
  const preferences = getPreferences();
  const items: ChecklistItem[] = [];

  // Parse appointments from survey
  const appointments = survey.parsedAppointments || parseAppointments(survey.appointments || '');

  // Track which recurring tasks are fulfilled by appointments
  const fulfilledTasks = new Set<string>();
  for (const apt of appointments) {
    if (apt.fulfillsTask) {
      fulfilledTasks.add(apt.fulfillsTask);
    }
  }

  // Track scheduled times to avoid conflicts (in minutes since midnight)
  const scheduledTimes: Array<{ start: number; end: number }> = [];

  // FEEDS ARE ESSENTIAL - Add them FIRST as fixed anchor points
  // These happen at their scheduled times regardless of appointments
  if (preferences.feedingTimes && preferences.feedingTimes.length > 0) {
    preferences.feedingTimes.forEach((time, index) => {
      const mins = parseTimeToMinutes(time);
      // Feeds are fixed - add them to scheduledTimes so OTHER activities avoid them
      scheduledTimes.push({ start: mins, end: mins + 30 });
      items.push({
        id: `feeding-${index}`,
        task: `Feed baby`,
        completed: false,
        type: 'feeding',
        time: minutesToTimeString(mins),
        timeBlock: getTimeBlock(mins),
        suggestedTime: minutesToTimeString(mins),
      });
    });
  }

  // Add appointment blocks to scheduled times (after feeds, so activities avoid both)
  for (const apt of appointments) {
    if (apt.startMins !== undefined && apt.endMins !== undefined) {
      scheduledTimes.push({ start: apt.startMins, end: apt.endMins });
    }
  }

  // Helper to check if a time slot is available (checks both feeds and appointments)
  const isSlotAvailable = (start: number, end: number): boolean => {
    for (const slot of scheduledTimes) {
      if (start < slot.end && end > slot.start) return false;
    }
    return true;
  };

  // Helper to find next available slot starting from a preferred time
  const findNextSlot = (preferredMins: number, duration: number): number => {
    // Try preferred time first
    if (isSlotAvailable(preferredMins, preferredMins + duration)) {
      return preferredMins;
    }
    // Search forward in 15-minute increments
    for (let mins = preferredMins + 15; mins <= 1170; mins += 15) { // Up to 7:30pm
      if (isSlotAvailable(mins, mins + duration)) {
        return mins;
      }
    }
    // Search backward if nothing found forward
    for (let mins = preferredMins - 15; mins >= 420; mins -= 15) { // From 7am
      if (isSlotAvailable(mins, mins + duration)) {
        return mins;
      }
    }
    return preferredMins; // Fallback
  };

  // Add naps
  const napTimes = ['10:00 AM', '2:30 PM'];
  if (preferences.napsPerDay && preferences.napsPerDay > 0) {
    for (let i = 0; i < preferences.napsPerDay; i++) {
      const napTime = napTimes[i] || napTimes[napTimes.length - 1];
      const preferredMins = parseTimeToMinutes(napTime);
      const duration = preferences.napDuration || 30;
      const mins = findNextSlot(preferredMins, duration);
      scheduledTimes.push({ start: mins, end: mins + duration });
      items.push({
        id: `nap-${i}`,
        task: `Nap ${i + 1} (~${duration}min)`,
        completed: false,
        type: 'nap',
        timeBlock: getTimeBlock(mins),
        suggestedTime: minutesToTimeString(mins),
      });
    }
  }

  // Recurring tasks with their default times and social flags
  const recurringTimeSlots: Record<string, { time: string; duration: number; social: boolean; exclusive: boolean }> = {
    'Read 5 books': { time: '9:00 AM', duration: 20, social: true, exclusive: false },
    'Eating solids': { time: '12:30 PM', duration: 30, social: false, exclusive: true },
    'Going for a walk': { time: '4:00 PM', duration: 45, social: true, exclusive: true },
    'Having a bath': { time: '6:00 PM', duration: 30, social: false, exclusive: true },
    'Vestibular play': { time: '11:00 AM', duration: 15, social: true, exclusive: false },
    'Crawling/walking practice': { time: '3:00 PM', duration: 20, social: true, exclusive: false },
    'Music time': { time: '5:00 PM', duration: 15, social: true, exclusive: false },
  };

  // Activities that are good for visitor time (can be done socially)
  const visitorFriendlyTasks = Object.entries(recurringTimeSlots)
    .filter(([, slot]) => slot.social)
    .map(([task]) => task);
  const visitorApt = appointments.find(a => a.type === 'visitor');

  preferences.recurringTasks.forEach((task, index) => {
    const defaultSlot = recurringTimeSlots[task] || { time: '9:00 AM', duration: 20 };

    // Check if this task is fulfilled by an appointment (e.g., walking with friend)
    if (fulfilledTasks.has(task)) {
      const apt = appointments.find(a => a.fulfillsTask === task);
      if (apt && apt.startMins !== undefined) {
        items.push({
          id: `recurring-${index}`,
          task: `${task} (with ${apt.description.replace(/walk.*with\s*/i, '').replace(/at\s*\d.*/i, '').trim() || 'friend'})`,
          completed: false,
          type: 'recurring',
          timeBlock: getTimeBlock(apt.startMins),
          suggestedTime: apt.startTime,
        });
        return;
      }
    }

    let preferredMins = parseTimeToMinutes(defaultSlot.time);

    // If there's a visitor, schedule social activities during their visit
    if (visitorApt && visitorApt.startMins !== undefined && visitorApt.endMins !== undefined) {
      if (visitorFriendlyTasks.includes(task)) {
        // Stagger activities within the visitor window
        const visitorDuration = visitorApt.endMins - visitorApt.startMins;
        const taskIndex = visitorFriendlyTasks.indexOf(task);
        preferredMins = visitorApt.startMins + Math.floor(visitorDuration * (taskIndex + 1) / (visitorFriendlyTasks.length + 1));
      }
    }

    const mins = findNextSlot(preferredMins, defaultSlot.duration);
    scheduledTimes.push({ start: mins, end: mins + defaultSlot.duration });

    items.push({
      id: `recurring-${index}`,
      task,
      completed: false,
      type: 'recurring',
      timeBlock: getTimeBlock(mins),
      suggestedTime: minutesToTimeString(mins),
      socialActivity: defaultSlot.social,
      canOverlap: !defaultSlot.exclusive,
    });
  });

  // Add bonus activities spread across the day
  const bonusActivities = selectBonusActivities(survey, weather, 3);
  const bonusDefaultTimes = [570, 810, 990]; // 9:30 AM, 1:30 PM, 4:30 PM

  bonusActivities.forEach((activity, index) => {
    let preferredMins = bonusDefaultTimes[index] || bonusDefaultTimes[0];

    // If there's a visitor and this is an indoor/social activity, schedule during visit
    if (visitorApt && visitorApt.startMins !== undefined && visitorApt.endMins !== undefined) {
      if (activity.indoor && (activity.category === 'sensory' || activity.category === 'social' || activity.category === 'creative')) {
        const visitorDuration = visitorApt.endMins - visitorApt.startMins;
        preferredMins = visitorApt.startMins + Math.floor(visitorDuration * (index + 1) / 4);
      }
    }

    const mins = findNextSlot(preferredMins, activity.duration);
    scheduledTimes.push({ start: mins, end: mins + activity.duration });

    items.push({
      id: `bonus-${index}`,
      task: `${activity.title} (${activity.duration}min)`,
      completed: false,
      type: 'bonus',
      activity,
      timeBlock: getTimeBlock(mins),
      suggestedTime: minutesToTimeString(mins),
    });
  });

  // Sort items by suggested time
  items.sort((a, b) => {
    const timeA = a.suggestedTime ? parseTimeToMinutes(a.suggestedTime) : 0;
    const timeB = b.suggestedTime ? parseTimeToMinutes(b.suggestedTime) : 0;
    return timeA - timeB;
  });

  return items;
}

// Get a specific activity by ID (for details view)
export function getActivityById(id: string): Activity | undefined {
  return activities.find(a => a.id === id);
}

// Get all activities (for browsing)
export function getAllActivities(): Activity[] {
  return activities;
}

// Filter activities by category
export function getActivitiesByCategory(category: Activity['category']): Activity[] {
  const babyAgeMonths = getBabyAgeMonths();
  return activities.filter(a =>
    a.category === category &&
    babyAgeMonths >= a.ageRange.min &&
    babyAgeMonths <= a.ageRange.max
  );
}
