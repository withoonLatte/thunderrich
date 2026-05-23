export enum UserRole {
  ADMIN = 'admin',
  USER = 'user'
}

export enum TournamentRound {
  GROUP = 'group',
  TOP32 = 'top32',
  TOP16 = 'top16',
  TOP8 = 'top8',
  TOP4 = 'top4',
  THIRD_PLACE = 'third_place',
  FINAL = 'final'
}

export enum MatchStatus {
  SCHEDULED = 'scheduled',
  LIVE = 'live',
  FINISHED = 'finished'
}

export enum PredictionChoice {
  HOME = 'home',
  AWAY = 'away'
}

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  role: UserRole;
  points: number;
  round1_wrong_count: number;
  yellow_cards: number;
  red_cards: number;
  bannedMatchIds: string[];
  mustChangePassword?: boolean;
  personalPin?: string;
}

export interface Match {
  id: string;
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  startTime: any; // Firestore Timestamp
  handicap: string;
  round: TournamentRound;
  homeScore?: number;
  awayScore?: number;
  status: MatchStatus;
  manualWinner?: 'home' | 'away' | 'push';
  predictionDeadline?: any; // Firestore Timestamp
  customWinScore?: number;
  customLossScore?: number;
  isPublished?: boolean;
}

export interface Prediction {
  id: string; // userId_matchId
  userId: string;
  matchId: string;
  choice: PredictionChoice;
  pointsEarned?: number;
  isResultCorrect?: boolean;
  isVoided: boolean;
  createdAt: any; // Firestore Timestamp
}

export interface Message {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  createdAt: any; // Firestore Timestamp
}

export interface AppConfig {
  logoUrl?: string;
  backgroundUrl?: string;
  lastUpdated: any;
}
