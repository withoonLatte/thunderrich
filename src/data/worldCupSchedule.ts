import { TournamentRound } from '../types';

export interface MockMatch {
  homeTeam: string;
  awayTeam: string;
  homeFlag: string;
  awayFlag: string;
  round: TournamentRound;
  startTime: string; // ISO string for easy selection
}

export const WORLD_CUP_2026_SCHEDULE: MockMatch[] = [
  {
    homeTeam: 'Mexico',
    awayTeam: 'USA',
    homeFlag: 'https://flagcdn.com/w80/mx.png',
    awayFlag: 'https://flagcdn.com/w80/us.png',
    round: TournamentRound.GROUP,
    startTime: '2026-06-11T20:00:00Z'
  },
  {
    homeTeam: 'Canada',
    awayTeam: 'England',
    homeFlag: 'https://flagcdn.com/w80/ca.png',
    awayFlag: 'https://flagcdn.com/w80/gb.png',
    round: TournamentRound.GROUP,
    startTime: '2026-06-12T15:00:00Z'
  },
  {
    homeTeam: 'Argentina',
    awayTeam: 'France',
    homeFlag: 'https://flagcdn.com/w80/ar.png',
    awayFlag: 'https://flagcdn.com/w80/fr.png',
    round: TournamentRound.GROUP,
    startTime: '2026-06-13T18:00:00Z'
  },
  {
    homeTeam: 'Brazil',
    awayTeam: 'Germany',
    homeFlag: 'https://flagcdn.com/w80/br.png',
    awayFlag: 'https://flagcdn.com/w80/de.png',
    round: TournamentRound.GROUP,
    startTime: '2026-06-14T12:00:00Z'
  },
  {
    homeTeam: 'Japan',
    awayTeam: 'Spain',
    homeFlag: 'https://flagcdn.com/w80/jp.png',
    awayFlag: 'https://flagcdn.com/w80/es.png',
    round: TournamentRound.GROUP,
    startTime: '2026-06-15T19:00:00Z'
  },
  {
    homeTeam: 'Thailand',
    awayTeam: 'South Korea',
    homeFlag: 'https://flagcdn.com/w80/th.png',
    awayFlag: 'https://flagcdn.com/w80/kr.png',
    round: TournamentRound.GROUP,
    startTime: '2026-06-16T17:00:00Z'
  }
];
