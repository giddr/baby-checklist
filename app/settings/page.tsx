'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getPreferences, savePreferences, getBabyAgeMonths } from '@/lib/storage';
import type { UserPreferences } from '@/types';

export default function SettingsPage() {
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [newTask, setNewTask] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setPreferences(getPreferences());
  }, []);

  const handleSave = () => {
    if (preferences) {
      savePreferences(preferences);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  const addTask = () => {
    if (newTask.trim() && preferences) {
      setPreferences({
        ...preferences,
        recurringTasks: [...preferences.recurringTasks, newTask.trim()],
      });
      setNewTask('');
    }
  };

  const removeTask = (index: number) => {
    if (preferences) {
      const updated = preferences.recurringTasks.filter((_, i) => i !== index);
      setPreferences({ ...preferences, recurringTasks: updated });
    }
  };

  if (!preferences) {
    return <div className="text-center py-8">Loading...</div>;
  }

  const babyAge = getBabyAgeMonths();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg"
        >
          ← Back
        </Link>
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      {/* Baby Info */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">👶 Baby Info</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Baby&apos;s name</label>
            <input
              type="text"
              value={preferences.babyName}
              onChange={(e) => setPreferences({ ...preferences, babyName: e.target.value })}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Birth date</label>
            <input
              type="date"
              value={preferences.babyBirthDate}
              onChange={(e) => setPreferences({ ...preferences, babyBirthDate: e.target.value })}
              className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
            />
            <p className="text-sm text-gray-500 mt-1">
              Currently {babyAge} months old
            </p>
          </div>
        </div>
      </div>

      {/* Location */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">📍 Location</h2>

        <div>
          <label className="block text-sm font-medium mb-1">City</label>
          <input
            type="text"
            value={preferences.location.name}
            onChange={(e) => setPreferences({
              ...preferences,
              location: { ...preferences.location, name: e.target.value }
            })}
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
          />
          <p className="text-sm text-gray-500 mt-1">
            Used for weather (currently Melbourne coordinates)
          </p>
        </div>
      </div>

      {/* Recurring Tasks */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">📋 Daily Recurring Tasks</h2>

        <div className="space-y-2 mb-4">
          {preferences.recurringTasks.map((task, index) => (
            <div
              key={index}
              className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
            >
              <span className="flex-1">{task}</span>
              <button
                onClick={() => removeTask(index)}
                className="text-red-500 hover:text-red-700 p-1"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={newTask}
            onChange={(e) => setNewTask(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTask()}
            placeholder="Add a new task..."
            className="flex-1 p-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
          />
          <button
            onClick={addTask}
            disabled={!newTask.trim()}
            className="btn btn-primary disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="btn btn-primary w-full"
      >
        {saved ? '✓ Saved!' : 'Save Changes'}
      </button>

      {/* About */}
      <div className="card text-center text-sm text-gray-500 dark:text-gray-400">
        <p>Baby Day Planner v1.0</p>
        <p className="mt-1">Made with 💜 for busy parents</p>
      </div>
    </div>
  );
}
