'use client';

import { useState, useEffect, useCallback } from 'react';
import Survey from '@/components/Survey';
import Checklist from '@/components/Checklist';
import CalendarReminder from '@/components/CalendarReminder';
import FeedbackPanel from '@/components/FeedbackPanel';
import {
  getTodaySurvey,
  saveSurvey,
  getTodayChecklist,
  saveChecklist,
  toggleChecklistItem,
  getPreferences,
  shouldShowCalendarReminder,
} from '@/lib/storage';
import { generateChecklist, getReplacementActivity } from '@/lib/activities';
import { fetchWeather } from '@/lib/weather';
import type { DailySurvey, DailyChecklist, WeatherData, ChecklistItem } from '@/types';

type View = 'loading' | 'survey' | 'checklist';

export default function Home() {
  const [view, setView] = useState<View>('loading');
  const [survey, setSurvey] = useState<DailySurvey | null>(null);
  const [checklist, setChecklist] = useState<DailyChecklist | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [showCalendarReminder, setShowCalendarReminder] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);

  // Load weather
  const loadWeather = useCallback(async () => {
    try {
      const prefs = getPreferences();
      const weatherData = await fetchWeather(prefs.location.lat, prefs.location.lng);
      setWeather(weatherData);
      return weatherData;
    } catch (error) {
      console.error('Failed to fetch weather:', error);
      return null;
    }
  }, []);

  // Initialize on mount
  useEffect(() => {
    const initialize = async () => {
      // Check for existing survey/checklist
      const existingSurvey = getTodaySurvey();
      const existingChecklist = getTodayChecklist();

      // Load weather in background
      const weatherData = await loadWeather();

      if (existingSurvey && existingChecklist) {
        setSurvey(existingSurvey);
        setChecklist(existingChecklist);
        setView('checklist');
      } else {
        setView('survey');
      }

      // Check if we should show calendar reminder
      if (shouldShowCalendarReminder()) {
        setShowCalendarReminder(true);
      }
    };

    initialize();
  }, [loadWeather]);

  // Handle survey completion
  const handleSurveyComplete = async (surveyData: DailySurvey) => {
    saveSurvey(surveyData);
    setSurvey(surveyData);

    // Generate checklist
    const items = generateChecklist(surveyData, weather);
    const newChecklist: DailyChecklist = {
      date: new Date().toISOString().split('T')[0],
      items,
      surveyCompleted: true,
    };
    saveChecklist(newChecklist);
    setChecklist(newChecklist);

    setView('checklist');
  };

  // Handle task toggle
  const handleToggle = (itemId: string) => {
    const updated = toggleChecklistItem(itemId);
    if (updated) {
      setChecklist(updated);
    }
  };

  // Handle edit survey
  const handleEditSurvey = () => {
    setView('survey');
  };

  // Handle start over - clears today's data and goes back to survey
  const handleStartOver = () => {
    localStorage.removeItem('baby-checklist-survey');
    localStorage.removeItem('baby-checklist-checklist');
    setSurvey(null);
    setChecklist(null);
    setView('survey');
  };

  // Handle reorder
  const handleReorder = (newItems: ChecklistItem[]) => {
    if (!checklist) return;
    const updated: DailyChecklist = {
      ...checklist,
      items: newItems,
    };
    saveChecklist(updated);
    setChecklist(updated);
  };

  // Handle refresh bonus activity - swap it for a different one
  const handleRefreshBonusActivity = (itemId: string) => {
    if (!checklist || !survey) return;

    const item = checklist.items.find(i => i.id === itemId);
    if (!item || item.type !== 'bonus') return;

    // Get IDs of all current bonus activities to exclude them
    const currentBonusIds = checklist.items
      .filter(i => i.type === 'bonus' && i.activity)
      .map(i => i.activity!.id);

    // Parse the scheduled time to minutes for cafe filtering
    let scheduledMins: number | undefined;
    if (item.suggestedTime) {
      const match = item.suggestedTime.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (match) {
        let hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const isPM = match[3].toUpperCase() === 'PM';
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
        scheduledMins = hours * 60 + minutes;
      }
    }

    // Get a replacement activity
    const replacement = getReplacementActivity(survey, weather, currentBonusIds, scheduledMins);
    if (!replacement) return;

    // Update the checklist with the new activity
    const newItems = checklist.items.map(i => {
      if (i.id === itemId) {
        return {
          ...i,
          task: `${replacement.title} (${replacement.duration}min)`,
          activity: replacement,
        };
      }
      return i;
    });

    const updated: DailyChecklist = {
      ...checklist,
      items: newItems,
    };
    saveChecklist(updated);
    setChecklist(updated);
  };

  // Render loading state
  if (view === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {view === 'survey' && (
        <Survey onComplete={handleSurveyComplete} />
      )}

      {view === 'checklist' && checklist && survey && (
        <Checklist
          items={checklist.items}
          weather={weather}
          survey={survey}
          onToggle={handleToggle}
          onReorder={handleReorder}
          onEditSurvey={handleEditSurvey}
          onStartOver={handleStartOver}
          onOpenFeedback={() => setShowFeedback(true)}
          onRefreshBonusActivity={handleRefreshBonusActivity}
        />
      )}

      {showFeedback && checklist && (
        <FeedbackPanel
          completedActivities={checklist.items.map(i => i.task)}
          onClose={() => setShowFeedback(false)}
        />
      )}

      {showCalendarReminder && (
        <CalendarReminder onDismiss={() => setShowCalendarReminder(false)} />
      )}
    </>
  );
}
