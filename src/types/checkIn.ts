export type DailyCheckInMood = 'good' | 'a_bit_tired' | 'very_fatigued' | 'unwell';

export type DailyCheckInSymptom = 'headache' | 'dizziness' | 'nausea' | 'other';

export type DailyCheckInDataOrigin = 'SELF_REPORTED' | 'SYNTHETIC';

export interface DailyCheckIn {
  id: string;
  profile_id: string;
  checkin_date: string;
  mood: DailyCheckInMood;
  energy_level: number;
  symptoms: DailyCheckInSymptom[];
  other_symptom?: string;
  note?: string;
  data_origin: DailyCheckInDataOrigin;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface DailyCheckInInput {
  profile_id: string;
  checkin_date?: string;
  mood: DailyCheckInMood;
  energy_level: number;
  symptoms: DailyCheckInSymptom[];
  other_symptom?: string;
  note?: string;
  data_origin: DailyCheckInDataOrigin;
  source: string;
}
