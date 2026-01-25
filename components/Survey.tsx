'use client';

import { useState, useEffect } from 'react';
import type { DailySurvey, ParsedAppointment } from '@/types';
import { parseAppointments } from '@/lib/activities';

interface SurveyProps {
  onComplete: (survey: DailySurvey) => void;
}

type Step = 'energy' | 'location' | 'activityMood' | 'appointments' | 'focus';

export default function Survey({ onComplete }: SurveyProps) {
  const [step, setStep] = useState<Step>('energy');
  const [answers, setAnswers] = useState<Partial<DailySurvey>>({
    date: new Date().toISOString().split('T')[0],
    focusAreas: [],
    freeTimeWindows: [],
    activityMoods: [],
  });
  const [parsedApts, setParsedApts] = useState<ParsedAppointment[]>([]);

  // Parse appointments as user types
  useEffect(() => {
    if (answers.appointments) {
      const parsed = parseAppointments(answers.appointments);
      setParsedApts(parsed);
    } else {
      setParsedApts([]);
    }
  }, [answers.appointments]);

  const updateAnswer = <K extends keyof DailySurvey>(key: K, value: DailySurvey[K]) => {
    setAnswers(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    const steps: Step[] = ['energy', 'location', 'activityMood', 'appointments', 'focus'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex < steps.length - 1) {
      setStep(steps[currentIndex + 1]);
    } else {
      // Set wantsCrafts based on activityMoods for backwards compatibility
      // Include parsed appointments
      const finalAnswers = {
        ...answers,
        wantsCrafts: answers.activityMoods?.includes('messy') || false,
        parsedAppointments: parsedApts,
      };
      onComplete(finalAnswers as DailySurvey);
    }
  };

  const prevStep = () => {
    const steps: Step[] = ['energy', 'location', 'activityMood', 'appointments', 'focus'];
    const currentIndex = steps.indexOf(step);
    if (currentIndex > 0) {
      setStep(steps[currentIndex - 1]);
    }
  };

  const progress = {
    energy: 20,
    location: 40,
    activityMood: 60,
    appointments: 80,
    focus: 100,
  }[step];

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-indigo-500 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step content */}
      <div className="card min-h-[300px] flex flex-col">
        {step === 'energy' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Good morning! ☀️</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              How&apos;s your energy level today?
            </p>
            <div className="grid grid-cols-3 gap-3 flex-1">
              {[
                { value: 'low', label: '😴', desc: 'Low' },
                { value: 'medium', label: '😊', desc: 'Medium' },
                { value: 'high', label: '⚡', desc: 'High' },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => updateAnswer('energyLevel', value as DailySurvey['energyLevel'])}
                  className={`survey-option flex flex-col items-center justify-center py-6 ${
                    answers.energyLevel === value ? 'selected' : ''
                  }`}
                >
                  <span className="text-3xl mb-2">{label}</span>
                  <span className="text-sm">{desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'location' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Today&apos;s plans 🏠</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Are you staying home or heading out?
            </p>
            <div className="grid grid-cols-2 gap-4 flex-1">
              <button
                onClick={() => updateAnswer('stayingHome', true)}
                className={`survey-option flex flex-col items-center justify-center py-8 ${
                  answers.stayingHome === true ? 'selected' : ''
                }`}
              >
                <span className="text-4xl mb-2">🏠</span>
                <span>Staying home</span>
              </button>
              <button
                onClick={() => updateAnswer('stayingHome', false)}
                className={`survey-option flex flex-col items-center justify-center py-8 ${
                  answers.stayingHome === false ? 'selected' : ''
                }`}
              >
                <span className="text-4xl mb-2">🚗</span>
                <span>Going out</span>
              </button>
            </div>
          </div>
        )}

        {step === 'activityMood' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-2">What sounds good today? 🌟</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Tap all that apply
            </p>
            <div className="grid grid-cols-2 gap-3 flex-1">
              {[
                { value: 'messy', label: '🎨 Messy play', desc: 'Paint, water, sensory bins' },
                { value: 'active', label: '🏃 Active play', desc: 'Movement, dancing, climbing' },
                { value: 'quiet', label: '🧘 Quiet time', desc: 'Calm, gentle activities' },
                { value: 'social', label: '👋 Social outing', desc: 'Playgroup, library, cafe' },
                { value: 'nature', label: '🌳 Nature time', desc: 'Park, garden, outdoors' },
                { value: 'learning', label: '🧠 Learning focus', desc: 'Books, puzzles, exploring' },
              ].map(({ value, label, desc }) => (
                <button
                  key={value}
                  onClick={() => {
                    const current = answers.activityMoods || [];
                    const updated = current.includes(value)
                      ? current.filter(v => v !== value)
                      : [...current, value];
                    updateAnswer('activityMoods', updated);
                  }}
                  className={`survey-option py-3 text-left ${
                    answers.activityMoods?.includes(value) ? 'selected' : ''
                  }`}
                >
                  <div className="font-medium">{label}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{desc}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 'appointments' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Any appointments? 📅</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Let me know if you have things scheduled
            </p>
            <textarea
              value={answers.appointments || ''}
              onChange={(e) => updateAnswer('appointments', e.target.value)}
              placeholder="e.g., Walking with Sarah at 1pm, friend coming over 2-4..."
              className="min-h-[100px] p-4 border-2 border-gray-200 dark:border-gray-700 rounded-xl resize-none focus:outline-none focus:border-indigo-500 dark:bg-gray-800"
            />

            {/* Show parsed appointments preview */}
            {parsedApts.length > 0 && (
              <div className="mt-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                <p className="text-xs font-medium text-indigo-700 dark:text-indigo-300 mb-2">
                  I&apos;ll plan around:
                </p>
                <div className="space-y-1">
                  {parsedApts.map((apt, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span className="text-indigo-500">
                        {apt.type === 'outing' ? '🚶' : apt.type === 'visitor' ? '👋' : apt.type === 'appointment' ? '📋' : '📌'}
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">
                        {apt.startTime && apt.endTime
                          ? `${apt.startTime} - ${apt.endTime}`
                          : apt.startTime || 'Flexible time'}
                      </span>
                      {apt.fulfillsTask && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                          ✓ counts as walk
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p className="text-xs text-gray-500 mt-2">
              Leave blank if your day is free
            </p>
          </div>
        )}

        {step === 'focus' && (
          <div className="flex-1 flex flex-col">
            <h2 className="text-xl font-semibold mb-2">Any focus areas? 🎯</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Tap any you want to emphasize today
            </p>
            <div className="grid grid-cols-2 gap-3 flex-1">
              {[
                { value: 'tummy-time', label: '🐛 Tummy time' },
                { value: 'solids', label: '🥄 Solids practice' },
                { value: 'crawling', label: '🦎 Crawling' },
                { value: 'sensory', label: '✋ Sensory play' },
                { value: 'social', label: '👋 Social skills' },
                { value: 'music', label: '🎵 Music & songs' },
              ].map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    const current = answers.focusAreas || [];
                    const updated = current.includes(value)
                      ? current.filter(v => v !== value)
                      : [...current, value];
                    updateAnswer('focusAreas', updated);
                  }}
                  className={`survey-option py-4 ${
                    answers.focusAreas?.includes(value) ? 'selected' : ''
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex gap-3 mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
          {step !== 'energy' && (
            <button onClick={prevStep} className="btn btn-secondary flex-1">
              Back
            </button>
          )}
          <button
            onClick={nextStep}
            disabled={
              (step === 'energy' && !answers.energyLevel) ||
              (step === 'location' && answers.stayingHome === undefined)
            }
            className="btn btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {step === 'focus' ? "Let's go! 🚀" : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}
