import type { WeatherData } from '@/types';

interface OpenMeteoResponse {
  current: {
    temperature_2m: number;
    weather_code: number;
  };
}

// Weather code mapping (WMO codes)
// https://open-meteo.com/en/docs
const WEATHER_CODES: Record<number, { condition: string; isRainy: boolean; isGood: boolean }> = {
  0: { condition: 'Clear sky', isRainy: false, isGood: true },
  1: { condition: 'Mainly clear', isRainy: false, isGood: true },
  2: { condition: 'Partly cloudy', isRainy: false, isGood: true },
  3: { condition: 'Overcast', isRainy: false, isGood: false },
  45: { condition: 'Foggy', isRainy: false, isGood: false },
  48: { condition: 'Depositing rime fog', isRainy: false, isGood: false },
  51: { condition: 'Light drizzle', isRainy: true, isGood: false },
  53: { condition: 'Moderate drizzle', isRainy: true, isGood: false },
  55: { condition: 'Dense drizzle', isRainy: true, isGood: false },
  61: { condition: 'Slight rain', isRainy: true, isGood: false },
  63: { condition: 'Moderate rain', isRainy: true, isGood: false },
  65: { condition: 'Heavy rain', isRainy: true, isGood: false },
  71: { condition: 'Slight snow', isRainy: false, isGood: false },
  73: { condition: 'Moderate snow', isRainy: false, isGood: false },
  75: { condition: 'Heavy snow', isRainy: false, isGood: false },
  80: { condition: 'Slight rain showers', isRainy: true, isGood: false },
  81: { condition: 'Moderate rain showers', isRainy: true, isGood: false },
  82: { condition: 'Violent rain showers', isRainy: true, isGood: false },
  95: { condition: 'Thunderstorm', isRainy: true, isGood: false },
};

export async function fetchWeather(lat: number, lng: number): Promise<WeatherData> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&timezone=auto`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch weather data');
  }

  const data: OpenMeteoResponse = await response.json();

  const weatherCode = data.current.weather_code;
  const weatherInfo = WEATHER_CODES[weatherCode] || {
    condition: 'Unknown',
    isRainy: false,
    isGood: true,
  };

  const temperature = Math.round(data.current.temperature_2m);

  // Consider temperature in "good weather" assessment
  // For baby outings, 15-28°C is comfortable
  const tempIsGood = temperature >= 15 && temperature <= 28;
  const isGoodWeather = weatherInfo.isGood && tempIsGood;

  return {
    temperature,
    condition: weatherInfo.condition,
    isRainy: weatherInfo.isRainy,
    isGoodWeather,
    description: `${temperature}°C, ${weatherInfo.condition.toLowerCase()}`,
  };
}

// Get weather emoji based on condition
export function getWeatherEmoji(weather: WeatherData): string {
  if (weather.isRainy) return '🌧️';
  if (weather.condition.includes('cloud')) return '☁️';
  if (weather.condition.includes('Clear') || weather.condition.includes('clear')) return '☀️';
  if (weather.condition.includes('Fog')) return '🌫️';
  if (weather.condition.includes('snow')) return '❄️';
  if (weather.condition.includes('Thunder')) return '⛈️';
  return '🌤️';
}
