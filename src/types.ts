export enum SupportedLanguage {
  ENGLISH = 'English',
  SPANISH = 'Spanish',
  FRENCH = 'French',
  GERMAN = 'German',
  JAPANESE = 'Japanese',
  KOREAN = 'Korean',
  CHINESE = 'Chinese',
  ITALIAN = 'Italian',
  PORTUGUESE = 'Portuguese',
  RUSSIAN = 'Russian',
  CZECH = 'Czech'
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  timestamp: Date;
  isTranslation?: boolean;
}

export interface AudioVisualizerProps {
  stream: MediaStream | null;
  isActive: boolean;
}

export enum AppMode {
  LIVE_TRANSLATOR = 'live_translator',
  TRANSCRIBE = 'transcribe'
}