import React, { useState, useEffect, useDeferredValue } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, Timestamp, deleteDoc, writeBatch, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TournamentRound, Match, MatchStatus, User, Prediction, PredictionChoice } from '../types';
import { useAuth, PLAYER_PINS } from '../contexts/AuthContext';
import { calculateMatchResults } from '../lib/gameLogic';
import { Trash2, Edit3, CheckCircle, PlusCircle, RefreshCw, Calendar, ChevronDown, Check, Camera, Loader2, Info, Zap, Star, FileUp, Users, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { WORLD_CUP_2026_SCHEDULE, MockMatch } from '../data/worldCupSchedule';
import * as XLSX from 'xlsx';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'matches' | 'history' | 'players' | 'custom'>('matches');
  const [selectedMatchDate, setSelectedMatchDate] = useState<string>('');
  const [manOfTheNight, setManOfTheNight] = useState<{ userId: string; updatedAt: any } | null>(null);
  const deferredAdminTab = useDeferredValue(activeAdminTab);
  const [showAdd, setShowAdd] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [calcPredsLoading, setCalcPredsLoading] = useState(false);
  
  // App Config State
  const [appConfig, setAppConfig] = useState<{ logoUrl?: string, backgroundUrl?: string } | null>(null);
  const [configSaving, setConfigSaving] = useState(false);
  const [matchSaving, setMatchSaving] = useState(false);
  
  // Match Form State
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [handicap, setHandicap] = useState('0');
  const [round, setRound] = useState<TournamentRound>(TournamentRound.GROUP);
  const [startTime, setStartTime] = useState('');
  const [predictionDeadline, setPredictionDeadline] = useState('');
  const [customWinScore, setCustomWinScore] = useState('');
  const [customLossScore, setCustomLossScore] = useState('');
  const [isSpecialMatch, setIsSpecialMatch] = useState(false);
  
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [calcLoading, setCalcLoading] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [hardResetLoading, setHardResetLoading] = useState(false);
  const [showMockList, setShowMockList] = useState(false);
  const [stagedMatches, setStagedMatches] = useState<(MockMatch & { stagedHandicap: string })[]>([]);
  const [batchDeadline, setBatchDeadline] = useState('');
  const [uploadingUid, setUploadingUid] = useState<string | null>(null);
  const [winners, setWinners] = useState<Record<string, 'home' | 'away' | 'push'>>({});
  const [calcStagedIds, setCalcStagedIds] = useState<string[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);

  useEffect(() => {
    const unsubMatches = onSnapshot(query(collection(db, 'matches'), orderBy('startTime', 'asc')), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Match));
      const sorted = [...docs].sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));
      setMatches(sorted);
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      const sortedUsers = snap.docs
        .map(d => d.data() as User)
        .sort((a, b) => b.points - a.points);
      setUsers(sortedUsers);
    });

    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        setAppConfig(snap.data() as any);
      }
    });

    const unsubAllPreds = onSnapshot(collection(db, 'predictions'), (snap) => {
      const preds = snap.docs.map(d => ({ id: d.id, ...d.data() } as Prediction));
      setAllPredictions(preds);
    });

    const unsubMan = onSnapshot(doc(db, 'settings', 'manOfTheNight'), (snap) => {
      if (snap.exists()) {
        setManOfTheNight(snap.data() as any);
      } else {
        setManOfTheNight(null);
      }
    });

    return () => {
      unsubMatches();
      unsubUsers();
      unsubConfig();
      unsubAllPreds();
      unsubMan();
    };
  }, []);

  useEffect(() => {
    if (matches.length > 0) {
      const todayStr = (() => {
        try {
          const formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const parts = formatter.format(new Date()).split('-');
          return `${parts[2]}/${parts[1]}/${parts[0]}`;
        } catch(e) {
          return '';
        }
      })();

      const matchDates = Array.from(new Set(matches.map(m => {
        const formatted = formatInThailandTime(m.startTime, 'dd/MM/yyyy HH:mm');
        return formatted ? formatted.slice(0, 10) : '';
      }).filter(d => d !== '')));

      if (matchDates.includes(todayStr)) {
        setSelectedMatchDate(todayStr);
      } else if (matchDates.length > 0 && (!selectedMatchDate || !matchDates.includes(selectedMatchDate))) {
        // Sort chronologically
        matchDates.sort((a, b) => {
          const [dayA, monthA, yearA] = a.split('/');
          const [dayB, monthB, yearB] = b.split('/');
          const dateA = new Date(Number(yearA), Number(monthA) - 1, Number(dayA));
          const dateB = new Date(Number(yearB), Number(monthB) - 1, Number(dayB));
          return dateA.getTime() - dateB.getTime();
        });
        setSelectedMatchDate(matchDates[0]);
      }
    }
  }, [matches]);

  const handleSelectManOfTheNight = async (userId: string) => {
    try {
      await setDoc(doc(db, 'settings', 'manOfTheNight'), {
        userId,
        updatedAt: Timestamp.now()
      });
    } catch (err) {
      console.error('Error setting Man of the Night:', err);
    }
  };

  const handleClearManOfTheNight = async () => {
    try {
      await deleteDoc(doc(db, 'settings', 'manOfTheNight'));
    } catch (err) {
      console.error('Error clearing Man of the Night:', err);
    }
  };

  const handleExportExcel = () => {
    try {
      // 1. Filter and sort Group stage matches
      const groupMatches = matches.filter(m => m.round === 'group');
      groupMatches.sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));

      // 2. Prepare CSV Header
      const headers = [
        'อันดับ',
        'ชื่อผู้เล่น',
        'คะแนนสะสมรวม',
        'ทายผิดสะสม'
      ];

      groupMatches.forEach((m, idx) => {
        const matchTitle = `${m.homeTeam} vs ${m.awayTeam}`;
        headers.push(`คู่ที่ ${idx + 1}: ${matchTitle} (ทายผล)`, `คู่ที่ ${idx + 1}: ${matchTitle} (เวลาทาย)`);
      });

      // 3. Filter and sort players
      const playersOnly = users.filter(u => u.role !== 'admin');
      playersOnly.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        const wrongA = a.round1_wrong_count || 0;
        const wrongB = b.round1_wrong_count || 0;
        if (wrongA !== wrongB) {
          return wrongA - wrongB;
        }
        return a.displayName.localeCompare(b.displayName, 'th');
      });

      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      };

      // 4. Build Rows
      const rows = [headers.map(escapeCSV).join(',')];

      playersOnly.forEach((u, idx) => {
        const rowData = [
          String(idx + 1),
          u.displayName,
          String(u.points),
          String(u.round1_wrong_count)
        ];

        groupMatches.forEach(m => {
          const p = allPredictions.find(pred => pred.userId === u.uid && pred.matchId === m.id);
          const isBanned = u.bannedMatchIds?.includes(m.id);
          
          let predictionStr = '';
          let timeStr = '-';

          if (isBanned) {
            predictionStr = 'โดนแบน (0)';
          } else if (p) {
            const teamChoice = p.choice === 'home' ? m.homeTeam : m.awayTeam;
            predictionStr = `${teamChoice} (${p.pointsEarned ?? 0})`;
            if (p.createdAt) {
              const date = p.createdAt.toDate ? p.createdAt.toDate() : new Date(p.createdAt.seconds * 1000);
              timeStr = date.toLocaleString('th-TH');
            }
          } else if (m.status === 'finished') {
            predictionStr = 'ไม่ได้ทาย (-1)';
          } else {
            predictionStr = 'ยังไม่ได้ทาย';
          }

          rowData.push(predictionStr, timeStr);
        });

        rows.push(rowData.map(escapeCSV).join(','));
      });

      // 5. Trigger download with UTF-8 BOM
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `thunderrich_group_predictions_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Error exporting predictions:', err);
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูล');
    }
  };

  const handleExportDailyVotesSummary = (selectedDateStr: string) => {
    if (!selectedDateStr) {
      alert('โปรดเลือกวันที่ต้องการส่งออกรายงาน');
      return;
    }

    try {
      // 1. Filter matches for the selected date
      const dayMatches = matches.filter(m => {
        const formatted = formatInThailandTime(m.startTime, 'dd/MM/yyyy HH:mm');
        return formatted && formatted.slice(0, 10) === selectedDateStr;
      });

      if (dayMatches.length === 0) {
        alert(`ไม่พบแมตช์การแข่งขันสำหรับวันที่ ${selectedDateStr}`);
        return;
      }

      // Sort matches by start time chronologically
      dayMatches.sort((a, b) => (a.startTime?.seconds || 0) - (b.startTime?.seconds || 0));

      // Get all players (excluding admin)
      const playersOnly = users.filter(u => u.role !== 'admin');
      // Sort players
      playersOnly.sort((a, b) => {
        if (b.points !== a.points) {
          return b.points - a.points;
        }
        const wrongA = a.round1_wrong_count || 0;
        const wrongB = b.round1_wrong_count || 0;
        if (wrongA !== wrongB) {
          return wrongA - wrongB;
        }
        return a.displayName.localeCompare(b.displayName, 'th');
      });

      const escapeCSV = (val: any) => {
        if (val === null || val === undefined) return '';
        let str = String(val);
        str = str.replace(/"/g, '""');
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          str = `"${str}"`;
        }
        return str;
      };

      const rows: string[] = [];

      // 2. Loop through each match of the day and build vertical sections
      dayMatches.forEach((m, matchIdx) => {
        const matchPreds = allPredictions.filter(p => p.matchId === m.id);
        const homeCount = matchPreds.filter(p => p.choice === 'home').length;
        const awayCount = matchPreds.filter(p => p.choice === 'away').length;
        const totalVotes = homeCount + awayCount;
        const homePercent = totalVotes > 0 ? Math.round((homeCount / totalVotes) * 100) : 0;
        const awayPercent = totalVotes > 0 ? Math.round((awayCount / totalVotes) * 100) : 0;

        const roundNames: Record<string, string> = {
          'group': 'รอบแบ่งกลุ่ม',
          'top32': 'รอบ 32 ทีม',
          'top16': 'รอบ 16 ทีม',
          'top8': 'รอบ 8 ทีม',
          'top4': 'รอบรองชนะเลิศ',
          'third_place': 'ชิงอันดับ 3',
          'final': 'รอบชิงชนะเลิศ'
        };
        const roundThai = roundNames[m.round] || m.round;
        const matchTime = formatInThailandTime(m.startTime, 'HH:mm');

        // Determine majority voted team (or equal)
        let majorityStr = '';
        if (totalVotes > 0) {
          if (homeCount > awayCount) {
            majorityStr = `โหวต ${m.homeTeam}`;
          } else if (awayCount > homeCount) {
            majorityStr = `โหวต ${m.awayTeam}`;
          } else {
            majorityStr = 'โหวตเท่ากัน';
          }
        }

        // Match Info + Majority Choice
        rows.push([
          escapeCSV(`คู่ที่ ${matchIdx + 1}: ${roundThai} | ${m.homeTeam} vs ${m.awayTeam} (เวลาแข่ง ${matchTime} น.)`),
          escapeCSV(majorityStr)
        ].join(','));
        
        // Consensus Summary row
        rows.push(escapeCSV(`สรุปผลโหวต -> โหวตรวมทั้งหมด: ${totalVotes} คน | โหวต ${m.homeTeam}: ${homeCount} คน (${homePercent}%) | โหวต ${m.awayTeam}: ${awayCount} คน (${awayPercent}%)`));
        
        // Separators
        rows.push('');
        rows.push('');
      });

      // 3. Trigger download with UTF-8 BOM
      const csvContent = '\uFEFF' + rows.join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `thunderrich_votes_${selectedDateStr.replace(/\//g, '-')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

    } catch (err) {
      console.error('Error exporting daily vote summary:', err);
      alert('เกิดข้อผิดพลาดในการส่งออกข้อมูลโหวตประจำวัน');
    }
  };

  const handleBulkImportText = async () => {
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    let processedLines: [string, string, string, string, string][] = []; // [homeTeam, awayTeam, handicap, startTimeStr, round]

    // Check if there are delimiters in the input
    const hasDelimiters = lines.some(line => line.includes('|') || line.includes('\t'));

    if (hasDelimiters) {
      processedLines = lines.map(line => {
        let cols: string[] = [];
        if (line.includes('|')) cols = line.split('|').map(s => s.trim());
        else if (line.includes('\t')) cols = line.split('\t').map(s => s.trim());
        
        // Handle the user's specific 3-column format: [DateStr, Team1, Team2]
        if (cols.length === 3) {
          const [rawDate, team1, team2] = cols;
          let cleanDateStr = rawDate.replace(/^[A-Za-z]+,\s+/, '').replace(/at\s+/g, '');
          if (!cleanDateStr.includes('2026')) {
             if (cleanDateStr.includes(',')) {
               cleanDateStr = cleanDateStr.replace(',', ', 2026,');
             } else {
               const parts = cleanDateStr.split(' ');
               if (parts.length >= 2) {
                  cleanDateStr = `${parts[0]} ${parts[1]}, 2026 ${parts.slice(2).join(' ')}`;
               }
             }
          }
          return [team1, team2, "0.0", cleanDateStr, "group"] as [string, string, string, string, string];
        }
        
        if (cols.length >= 4) {
          const rawRound = cols[4]?.trim().toLowerCase();
          const allowedRounds = ['group', 'top32', 'top16', 'top8', 'top4', 'third_place', 'final'];
          const rd = allowedRounds.includes(rawRound) ? rawRound : 'group';
          return [cols[0], cols[1], cols[2], cols[3], rd] as [string, string, string, string, string];
        }
        return null;
      }).filter((l): l is [string, string, string, string, string] => l !== null);
    } else {
      // 3-line format:
      // Loop through lines by step of 3
      for (let i = 0; i < lines.length - 2; i += 3) {
        const rawDate = lines[i];
        const team1 = lines[i+1];
        const team2 = lines[i+2];

        let cleanDateStr = rawDate.replace(/^[A-Za-z]+,\s+/, '').replace(/at\s+/g, '');
        if (!cleanDateStr.includes('2026')) {
           if (cleanDateStr.includes(',')) {
             cleanDateStr = cleanDateStr.replace(',', ', 2026,');
           } else {
             const parts = cleanDateStr.split(' ');
             if (parts.length >= 2) {
                cleanDateStr = `${parts[0]} ${parts[1]}, 2026 ${parts.slice(2).join(' ')}`;
             }
           }
        }
        processedLines.push([team1, team2, "0.0", cleanDateStr, "group"]);
      }
    }

    if (processedLines.length === 0) {
      alert('ไม่พบข้อมูลที่ถูกต้อง (รูปแบบ: ทีมเหย้า | ทีมเยือน | ราคา | เวลา | รอบการแข่งขัน(ไม่ระบุเป็น group) หรือ สลับ 3 บรรทัด)');
      return;
    }

    if (window.confirm(`ตรวจพบ ${processedLines.length} คู่ ต้องการเพิ่มทั้งหมดหรือไม่?`)) {
      setBatchLoading(true);
      try {
        const querySnapshot = await getDocs(collection(db, 'matches'));
        const existingMatches = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));

        const batch = writeBatch(db);
        const seenIds = new Set<string>();
        let addedCount = 0;

        processedLines.forEach((cols) => {
          const [h, a, hc, st, rd] = cols;
          if (h && a && hc && st) {
            const startDate = parseThailandDate(st);
            if (isNaN(startDate.getTime())) return;
            
            // Calculate prediction deadline: day before at 20:00 in Thailand Time
            const dayBefore = new Date(startDate.getTime() - 24 * 60 * 60 * 1000);
            const formatter = new Intl.DateTimeFormat('sv-SE', {
              timeZone: 'Asia/Bangkok',
              year: 'numeric',
              month: '2-digit',
              day: '2-digit'
            });
            const formattedDate = formatter.format(dayBefore);
            const deadlineDate = parseThailandDate(`${formattedDate} 20:00:00`);
            
            const existing = existingMatches.find(m => 
              m.homeTeam.trim().toLowerCase() === h.trim().toLowerCase() && 
              m.awayTeam.trim().toLowerCase() === a.trim().toLowerCase()
            );

            if (existing) {
              const matchRef = doc(db, 'matches', existing.id);
              batch.update(matchRef, {
                handicap: hc,
                startTime: Timestamp.fromDate(startDate),
                predictionDeadline: Timestamp.fromDate(deadlineDate),
                round: rd as TournamentRound
              });
              addedCount++;
            } else {
              const startMs = startDate.getTime();
              const matchId = `${h.replace(/\s+/g, '_')}_${a.replace(/\s+/g, '_')}_${startMs}`;
              
              if (seenIds.has(matchId)) return;
              seenIds.add(matchId);
              addedCount++;

              const matchRef = doc(db, 'matches', matchId);
              
              batch.set(matchRef, {
                id: matchId,
                homeTeam: h,
                awayTeam: a,
                handicap: hc,
                startTime: Timestamp.fromDate(startDate),
                predictionDeadline: Timestamp.fromDate(deadlineDate),
                round: rd as TournamentRound,
                homeFlag: getTeamFlag(h),
                awayFlag: getTeamFlag(a),
                status: MatchStatus.SCHEDULED,
                isPublished: false
              });
            }
          }
        });

        await batch.commit();
        setBulkText('');
        alert(`เพิ่ม/อัปเดตแมตช์สำเร็จจำนวน ${addedCount} คู่!`);
      } catch (err) {
        console.error(err);
        alert('เกิดข้อผิดพลาดในการนำเข้าข้อมูล: ' + (err as Error).message);
      } finally {
        setBatchLoading(false);
      }
    }
  };

  const handleExcelImport = async (file: File) => {
    if (!file) return;
    setBatchLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array', cellDates: true });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
          
          if (!json || json.length === 0) {
            alert('ไม่พบข้อมูลในไฟล์ Excel');
            setBatchLoading(false);
            return;
          }

          // Helper to convert Excel date serial to JS Date
          const parseExcelSerialDate = (serial: number): Date => {
            const utc_days = Math.floor(serial - 25569);
            const utc_value = utc_days * 86400;
            const date_info = new Date(utc_value * 1000);
            const fractional_day = serial - Math.floor(serial) + 0.0000001;
            let total_seconds = Math.floor(86400 * fractional_day);
            const seconds = total_seconds % 60;
            total_seconds -= seconds;
            const hours = Math.floor(total_seconds / (60 * 60));
            const minutes = Math.floor(total_seconds / 60) % 60;
            return new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
          };

          const validRows: { h: string; a: string; hc: string; startDate: Date }[] = [];

          json.forEach((row) => {
            if (!row || row.length < 2) return;

            // Trim cell values and identify empty/header cells
            const cells = row.map(cell => {
              if (cell instanceof Date) return cell;
              if (typeof cell === 'number') return cell;
              return String(cell || '').trim();
            });

            // Skip potential headers or rows that are mostly empty
            const textCells = cells.filter(c => typeof c === 'string');
            const isHeader = textCells.some(cellStr => {
              const lower = cellStr.toLowerCase();
              return ['date', 'time', 'เหย้า', 'เยือน', 'เวลา', 'ทีม', 'handicap', 'ราคา', 'ต่อรอง', 'คู่แข่ง', 'ลำดับ', 'match', 'vs'].some(kw => lower.includes(kw));
            });
            if (isHeader) return;

            let homeTeam = '';
            let awayTeam = '';
            let handicap = '0';
            let startDate: Date | null = null;
            let dateIndex = -1;

            // 1. Auto-detect date/time cell
            for (let i = 0; i < cells.length; i++) {
              const cell = cells[i];
              if (cell instanceof Date) {
                startDate = parseLocalDateToThailandDate(cell);
                dateIndex = i;
                break;
              }
              if (typeof cell === 'number') {
                // If it is serial format like 45000+
                if (cell > 40000 && cell < 60000) {
                  startDate = parseLocalDateToThailandDate(parseExcelSerialDate(cell));
                  dateIndex = i;
                  break;
                }
              }
              if (typeof cell === 'string' && cell.length > 5) {
                // Try converting typical formats e.g. "June 11, at 3:00 PM"
                let cleanStr = cell.replace(/^[A-Za-z]+,\s+/, '').replace(/at\s+/g, '');
                if (!cleanStr.includes('2026') && cleanStr.length > 5) {
                  const parts = cleanStr.split(/\s+/);
                  if (parts.length >= 2) {
                    cleanStr = `${parts[0]} ${parts[1]}, 2026 ${parts.slice(2).join(' ')}`;
                  }
                }
                const d = parseThailandDate(cleanStr);
                if (!isNaN(d.getTime())) {
                  startDate = d;
                  dateIndex = i;
                  break;
                }
              }
            }

            // 2. Filter remaining cell indexes
            const remaining = cells
              .map((cell, idx) => ({ cell, idx }))
              .filter(item => item.idx !== dateIndex);

            // 3. Find check handicap or number
            let handicapIndex = -1;
            for (let i = 0; i < remaining.length; i++) {
              const { cell, idx } = remaining[i];
              const cellStr = String(cell || '').trim();
              const isHc = (typeof cell === 'number') || 
                           /^[+-]\d/.test(cellStr) || 
                           cellStr.includes('/') || 
                           (!isNaN(Number(cellStr)) && Number(cellStr) >= -10 && Number(cellStr) <= 10);
              
              if (isHc && cellStr !== '') {
                handicap = cellStr;
                handicapIndex = idx;
                break;
              }
            }

            // 4. Remaining must be team names
            const teamCells = remaining.filter(item => item.idx !== handicapIndex);
            if (teamCells.length >= 2) {
              homeTeam = String(teamCells[0].cell || '').trim();
              awayTeam = String(teamCells[1].cell || '').trim();
            } else if (teamCells.length === 1) {
              const cellStr = String(teamCells[0].cell || '').trim();
              if (cellStr.includes('vs')) {
                const parts = cellStr.split('vs');
                homeTeam = parts[0].trim();
                awayTeam = parts[1].trim();
              } else if (cellStr.includes('-')) {
                const parts = cellStr.split('-');
                homeTeam = parts[0].trim();
                awayTeam = parts[1].trim();
              }
            }

            if (homeTeam && awayTeam && startDate && !isNaN(startDate.getTime())) {
              validRows.push({
                h: homeTeam,
                a: awayTeam,
                hc: handicap,
                startDate
              });
            }
          });

          if (validRows.length === 0) {
            alert('ไม่พบข้อมูลการแข่งขันที่ถูกต้องในไฟล์ Excel (ตรวจพบ 0 คู่, อาจจะเป็นเพราะรูปแบบวันเวลาไม่ถูกต้อง)');
            setBatchLoading(false);
            return;
          }

          if (window.confirm(`ตรวจพบ ${validRows.length} คู่ในไฟล์ Excel ต้องการนำเข้าทั้งหมดและบันทึกสู่ระบบใช่หรือไม่?`)) {
            const querySnapshot = await getDocs(collection(db, 'matches'));
            const existingMatches = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Match));

            const batch = writeBatch(db);
            const seenIds = new Set<string>();
            let addedCount = 0;

            validRows.forEach((row) => {
              const startDate = row.startDate;
              
              const existing = existingMatches.find(m => 
                m.homeTeam.trim().toLowerCase() === row.h.trim().toLowerCase() && 
                m.awayTeam.trim().toLowerCase() === row.a.trim().toLowerCase()
              );

              if (existing) {
                const matchRef = doc(db, 'matches', existing.id);
                batch.update(matchRef, {
                  handicap: row.hc,
                  startTime: Timestamp.fromDate(startDate),
                  predictionDeadline: Timestamp.fromDate(new Date(startDate.getTime() - 3600000)),
                });
                addedCount++;
              } else {
                const startMs = startDate.getTime();
                const matchId = `${row.h.replace(/\s+/g, '_')}_${row.a.replace(/\s+/g, '_')}_${startMs}`;
                
                if (seenIds.has(matchId)) return;
                seenIds.add(matchId);
                addedCount++;

                const matchRef = doc(db, 'matches', matchId);
                
                batch.set(matchRef, {
                  id: matchId,
                  homeTeam: row.h,
                  awayTeam: row.a,
                  handicap: row.hc,
                  startTime: Timestamp.fromDate(startDate),
                  predictionDeadline: Timestamp.fromDate(new Date(startDate.getTime() - 3600000)),
                  round: TournamentRound.GROUP,
                  homeFlag: getTeamFlag(row.h),
                  awayFlag: getTeamFlag(row.a),
                  status: MatchStatus.SCHEDULED,
                  isPublished: false,
                  allowPredictions: false
                });
              }
            });
            await batch.commit();
            alert(`นำเข้าจาก Excel สำเร็จแล้ว! (เพิ่ม/อัปเดตเข้าสู่ระบบจำนวน ${addedCount} คู่สำเร็จ) 🎉`);
          }
        } catch (err) {
          console.error('XLSX parsing error:', err);
          alert('รูปแบบไฟล์ไม่ถูกต้อง หรือ ไม่สามารถอ่านวันเวลาได้: ' + (err as Error).message);
        } finally {
          setBatchLoading(false);
        }
      };
      reader.readAsArrayBuffer(file);
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
      setBatchLoading(false);
    }
  };

  const handleResetForKnockout = async () => {
    if (!window.confirm('คุณแน่ใจหรือไม่ว่าต้องการรีเซ็ตใบเหลือง/แดงและจำนวนการทายผิดสำหรับรอบ 16 ทีม? คะแนนสะสมจะยังคงอยู่')) return;
    
    setResetLoading(true);
    const batch = writeBatch(db);
    
    users.forEach(user => {
      const userRef = doc(db, 'users', user.uid);
      batch.update(userRef, {
        round1_wrong_count: 0,
        yellow_cards: 0,
        red_cards: 0,
        bannedMatchIds: []
      });
    });

    await batch.commit();
    setResetLoading(false);
    alert('รีเซ็ตใบเหลือง/แดงและจำนวนการทายผิดสำหรับรอบน็อกเอาต์เรียบร้อยแล้ว!');
  };

  const handleCalculatePredictions = async () => {
    const scheduledMatches = matches.filter(m => m.status === MatchStatus.SCHEDULED);
    const pastDeadlineMatches = scheduledMatches.filter(m => {
      if (!m.predictionDeadline) return false;
      const deadlineDate = m.predictionDeadline.toDate ? m.predictionDeadline.toDate() : new Date(m.predictionDeadline.seconds * 1000);
      return deadlineDate <= new Date();
    });

    if (pastDeadlineMatches.length === 0) {
      alert('ไม่มีแมตช์ที่เลยกำหนดเวลาส่งทายผลและยังไม่ได้เริ่มคำนวณคะแนน');
      return;
    }

    const matchTitles = pastDeadlineMatches.map(m => `- ${m.homeTeam} vs ${m.awayTeam}`).join('\n');
    if (!window.confirm(`คุณแน่ใจหรือไม่ว่าต้องการคำนวณคะแนนบทลงโทษสำหรับแมตช์ที่เลยกำหนดเวลาแล้วเหล่านี้?\n\n${matchTitles}\n\nระบบจะหักคะแนนผู้ที่ไม่ได้ส่งทายผลโดยอัตโนมัติ`)) {
      return;
    }

    setCalcPredsLoading(true);
    try {
      const batch = writeBatch(db);
      let penaltyCount = 0;
      let userPointsDiff: Record<string, number> = {};

      const NO_PRED_PENALTY: Record<string, number> = {
        'group': -1,
        'top32': -1,
        'top16': -2,
        'top8': -2,
        'top4': -3,
        'third_place': -3,
        'final': -3,
      };

      const playersOnly = users.filter(u => u.role !== 'admin');

      for (const m of pastDeadlineMatches) {
        const matchPreds = allPredictions.filter(p => p.matchId === m.id);
        
        for (const u of playersOnly) {
          const isBanned = u.bannedMatchIds?.includes(m.id);
          const p = matchPreds.find(pred => pred.userId === u.uid);

          if (!isBanned && (!p || p.choice === null || p.choice === undefined)) {
            if (p && p.choice === null) continue;

            const penaltyPoints = NO_PRED_PENALTY[m.round] || -1;
            const predId = `${u.uid}_${m.id}`;
            const newPredRef = doc(db, 'predictions', predId);

            batch.set(newPredRef, {
              id: predId,
              userId: u.uid,
              matchId: m.id,
              choice: null,
              pointsEarned: penaltyPoints,
              isResultCorrect: false,
              isVoided: true,
              createdAt: Timestamp.now()
            });

            userPointsDiff[u.uid] = (userPointsDiff[u.uid] || 0) + penaltyPoints;
            penaltyCount++;
          }
        }
      }

      for (const [uid, diff] of Object.entries(userPointsDiff)) {
        const user = users.find(usr => usr.uid === uid);
        if (user) {
          const userRef = doc(db, 'users', uid);
          batch.update(userRef, {
            points: (user.points || 0) + diff
          });
        }
      }

      if (penaltyCount > 0) {
        await batch.commit();
        alert(`คำนวณเรียบร้อยแล้ว! ลงโทษผู้ที่ส่งคำทายไม่ทันไปทั้งหมด ${penaltyCount} รายการ`);
      } else {
        alert('ทุกคนทายครบถ้วนแล้ว ไม่มีผู้เล่นโดนหักคะแนน');
      }
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการคำนวณคะแนน');
    } finally {
      setCalcPredsLoading(false);
    }
  };

  const handleHardReset = async () => {
    if (!window.confirm('⚠️ คำเตือน: คุณแน่ใจหรือไม่ว่าต้องการล้างข้อมูลทั้งหมด? (แมตช์, การทายผล, ข้อความ และผู้เล่น) กู้คืนไม่ได้!')) return;
    if (!window.confirm('ยืนยันอีกครั้ง: ทุกอย่างจะหายไป ยกเว้นบัญชีแอดมินของคุณเอง')) return;

    setHardResetLoading(true);
    try {
      const batch = writeBatch(db);

      // 1. Delete Predictions
      const predSnap = await getDocs(collection(db, 'predictions'));
      predSnap.forEach(d => batch.delete(d.ref));

      // 2. Delete Webboard messages
      const boardSnap = await getDocs(collection(db, 'webboard'));
      boardSnap.forEach(d => batch.delete(d.ref));

      // 3. Delete Matches
      const matchSnap = await getDocs(collection(db, 'matches'));
      matchSnap.forEach(d => batch.delete(d.ref));

      // 4. Delete Users (Except current)
      const userSnap = await getDocs(collection(db, 'users'));
      userSnap.forEach(d => {
        if (d.id !== user?.uid) {
          batch.delete(d.ref);
        } else {
          // Reset own profile score if needed, but maybe leave it? 
          // User asked to clear "user demo", so clearing others is enough.
          batch.update(d.ref, { points: 0, round1_wrong_count: 0, yellow_cards: 0, red_cards: 0, bannedMatchIds: [] });
        }
      });

      await batch.commit();
      alert('ล้างข้อมูลทั้งหมดเรียบร้อยแล้ว');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการล้างข้อมูล: ' + err.message);
    } finally {
      setHardResetLoading(false);
    }
  };

  const handleConfigUpload = async (type: 'logo' | 'background', file: File) => {
    if (!file) return;
    
    setConfigSaving(true);

    try {
      const reader = new FileReader();
      reader.onerror = () => {
        alert('เกิดข้อผิดพลาดในการอ่านไฟล์');
        setConfigSaving(false);
      };
      reader.onload = async (e) => {
        const img = new Image();
        img.onerror = () => {
          alert('เกิดข้อผิดพลาดในการโหลดรูปภาพ');
          setConfigSaving(false);
        };
        img.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            const MAX_SIZE = type === 'background' ? 1200 : 400;
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > MAX_SIZE) {
                height *= MAX_SIZE / width;
                width = MAX_SIZE;
              }
            } else {
              if (height > MAX_SIZE) {
                width *= MAX_SIZE / height;
                height = MAX_SIZE;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx?.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
            
            await setDoc(doc(db, 'settings', 'app_config'), {
              [type === 'logo' ? 'logoUrl' : 'backgroundUrl']: dataUrl,
              lastUpdated: Timestamp.now()
            }, { merge: true });
          } catch (err) {
            console.error('Save error:', err);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
          } finally {
            setConfigSaving(false);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Config upload error:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลด');
      setConfigSaving(false);
    }
  };

  const handleResetConfig = async () => {
    if (window.confirm('คืนค่าเริ่มต้น Logo และ Background?')) {
      await setDoc(doc(db, 'settings', 'app_config'), {
        logoUrl: null,
        backgroundUrl: null,
        lastUpdated: Timestamp.now()
      }, { merge: true });
    }
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || !startTime) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    setMatchSaving(true);
    try {
      const date = parseThailandDate(startTime);
      let deadlineDate = date;
      if (predictionDeadline) {
        deadlineDate = parseThailandDate(predictionDeadline);
      } else {
        const dayBefore = new Date(date.getTime() - 24 * 60 * 60 * 1000);
        const formatter = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const formattedDate = formatter.format(dayBefore);
        deadlineDate = parseThailandDate(`${formattedDate} 20:00:00`);
      }
      
      if (editingMatchId) {
        await updateDoc(doc(db, 'matches', editingMatchId), {
          homeTeam,
          awayTeam,
          homeFlag: getTeamFlag(homeTeam), 
          awayFlag: getTeamFlag(awayTeam),
          handicap: handicap,
          round: round,
          startTime: Timestamp.fromDate(date),
          predictionDeadline: Timestamp.fromDate(deadlineDate),
          customWinScore: isSpecialMatch ? Number(customWinScore) : null,
          customLossScore: isSpecialMatch ? Number(customLossScore) : null,
          isPublished: true, // Auto publish on save edit
          allowPredictions: false // Reset to locked on edit/save
        });
        setEditingMatchId(null);
      } else {
        await addDoc(collection(db, 'matches'), {
          homeTeam,
          awayTeam,
          homeFlag: getTeamFlag(homeTeam), 
          awayFlag: getTeamFlag(awayTeam),
          handicap: handicap,
          round: round,
          startTime: Timestamp.fromDate(date),
          predictionDeadline: Timestamp.fromDate(deadlineDate),
          status: MatchStatus.SCHEDULED,
          customWinScore: isSpecialMatch ? Number(customWinScore) : null,
          customLossScore: isSpecialMatch ? Number(customLossScore) : null,
          isPublished: true, // Auto publish on manual add
          allowPredictions: false // Initialize to closed by default
        } as any);
      }

      setShowAdd(false);
      resetForm();
      alert('บันทึกข้อมูลเรียบร้อยแล้ว!');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setMatchSaving(false);
    }
  };

  const parseThailandDate = (dateStr: string): Date => {
    if (!dateStr) return new Date(NaN);
    const trimmed = dateStr.trim();
    if (trimmed.includes('+') || trimmed.includes('Z') || /-[0-9]{2}:[0-9]{2}$/.test(trimmed)) {
      return new Date(trimmed);
    }
    let isoStr = trimmed.replace(' ', 'T');
    const tParts = isoStr.split('T');
    if (tParts.length === 2) {
      const timeParts = tParts[1].split(':');
      if (timeParts.length === 2) {
        isoStr = isoStr + ':00';
      }
    }
    return new Date(isoStr + '+07:00');
  };

  const parseLocalDateToThailandDate = (d: Date): Date => {
    if (!d || isNaN(d.getTime())) return new Date(NaN);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const date = d.getDate();
    const hours = d.getHours();
    const minutes = d.getMinutes();
    const seconds = d.getSeconds();
    
    const isoStr = `${year}-${String(month).padStart(2, '0')}-${String(date).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    return parseThailandDate(isoStr);
  };

  const safeFormatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      let date: Date;
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp.seconds !== undefined) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      if (isNaN(date.getTime())) return '';

      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const formatted = formatter.format(date);
      return formatted.replace(' ', 'T').substring(0, 16);
    } catch (err) {
      console.error('Error formatting date:', err);
    }
    return '';
  };

  const formatInThailandTime = (timestamp: any, formatStr: 'dd/MM/yyyy HH:mm' | 'HH:mm' | 'dd/MM'): string => {
    if (!timestamp) return '';
    try {
      let date: Date;
      if (typeof timestamp.toDate === 'function') {
        date = timestamp.toDate();
      } else if (timestamp.seconds !== undefined) {
        date = new Date(timestamp.seconds * 1000);
      } else {
        date = new Date(timestamp);
      }
      if (isNaN(date.getTime())) return '';

      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Bangkok',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      const formatted = formatter.format(date);
      const parts = formatted.split(' ');
      if (parts.length !== 2) return '';
      const [datePart, timePart] = parts;
      const [year, month, day] = datePart.split('-');
      const [hour, minute] = timePart.split(':');

      if (formatStr === 'dd/MM/yyyy HH:mm') {
        return `${day}/${month}/${year} ${hour}:${minute}`;
      } else if (formatStr === 'HH:mm') {
        return `${hour}:${minute}`;
      } else if (formatStr === 'dd/MM') {
        return `${day}/${month}`;
      }
    } catch (err) {
      console.error('Error formatting Thailand time:', err);
    }
    return '';
  };

  const handleEditMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setHomeTeam(match.homeTeam);
    setAwayTeam(match.awayTeam);
    setHandicap(match.handicap);
    setRound(match.round);
    
    const startStr = safeFormatTimestamp(match.startTime);
    setStartTime(startStr);

    if (match.predictionDeadline) {
      setPredictionDeadline(safeFormatTimestamp(match.predictionDeadline));
    } else {
      let matchDate: Date | null = null;
      if (match.startTime) {
        if (typeof match.startTime.toDate === 'function') {
          matchDate = match.startTime.toDate();
        } else if (match.startTime.seconds !== undefined) {
          matchDate = new Date(match.startTime.seconds * 1000);
        } else {
          matchDate = new Date(match.startTime);
        }
      }
      if (matchDate && !isNaN(matchDate.getTime())) {
        const dayBefore = new Date(matchDate.getTime() - 24 * 60 * 60 * 1000);
        const formatter = new Intl.DateTimeFormat('sv-SE', {
          timeZone: 'Asia/Bangkok',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        const formattedDate = formatter.format(dayBefore);
        setPredictionDeadline(`${formattedDate}T20:00`);
      } else {
        setPredictionDeadline('');
      }
    }
    
    if (match.customWinScore !== undefined && match.customWinScore !== null) {
      setIsSpecialMatch(true);
      setCustomWinScore(String(match.customWinScore));
      setCustomLossScore(String(match.customLossScore));
    } else {
      setIsSpecialMatch(false);
      setCustomWinScore('');
      setCustomLossScore('');
    }
    
    setShowAdd(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartTimeChange = (value: string) => {
    setStartTime(value);
    if (value) {
      try {
        const date = parseThailandDate(value);
        if (!isNaN(date.getTime())) {
          const dayBefore = new Date(date.getTime() - 24 * 60 * 60 * 1000);
          const formatter = new Intl.DateTimeFormat('sv-SE', {
            timeZone: 'Asia/Bangkok',
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          });
          const formattedDate = formatter.format(dayBefore);
          setPredictionDeadline(`${formattedDate}T20:00`);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  const getCountryCode = (team: string) => {
    if (!team || typeof team !== 'string') return 'un';
    const codes: Record<string, string> = {
      'Mexico': 'mx', 'USA': 'us', 'United States': 'us', 'Canada': 'ca', 'England': 'gb',
      'Argentina': 'ar', 'France': 'fr', 'Brazil': 'br', 'Germany': 'de',
      'Japan': 'jp', 'Spain': 'es', 'Thailand': 'th', 'South Korea': 'kr',
      'South Africa': 'za', 'Paraguay': 'py', 'Qatar': 'qa', 'Switzerland': 'ch',
      'Morocco': 'ma', 'Haiti': 'ht', 'Scotland': 'gb-sct', 'Australia': 'au',
      'Netherlands': 'nl', 'Ivory Coast': 'ci', 'Ecuador': 'ec', 'Tunisia': 'tn',
      'Cape Verde': 'cv', 'Belgium': 'be', 'Egypt': 'eg', 'Saudi Arabia': 'sa',
      'Uruguay': 'uy', 'Iran': 'ir', 'New Zealand': 'nz', 'Senegal': 'sn',
      'Norway': 'no', 'Algeria': 'dz', 'Austria': 'at', 'Jordan': 'jo',
      'Portugal': 'pt', 'Croatia': 'hr', 'Ghana': 'gh', 'Panama': 'pa',
      'Uzbekistan': 'uz', 'Colombia': 'co', 'Iraq': 'iq', 'Italy': 'it',
      'Czechia': 'cz', 'Bosnia and Herzegovina': 'ba', 'Türkiye': 'tr', 'Turkey': 'tr',
      'Curacao': 'cw', 'Sweden': 'se', 'Congo DR': 'cd'
    };
    
    const teamLower = team.toUpperCase();
    if (teamLower.includes('UEFA') || teamLower.includes('FIFA')) return 'un';
    
    return codes[team] || team.substring(0, 2).toLowerCase();
  };

  const getTeamFlag = (team: string) => {
    if (!team || typeof team !== 'string') return 'https://flagcdn.com/w80/un.png';
    
    const clubBadges: Record<string, string> = {
      'Brighton and Hove Albion': 'https://crests.football-data.org/397.png',
      'Brighton': 'https://crests.football-data.org/397.png',
      'Manchester United': 'https://crests.football-data.org/66.png',
      'Man United': 'https://crests.football-data.org/66.png',
      'Burnley': 'https://crests.football-data.org/328.png',
      'Wolverhampton Wanderers': 'https://crests.football-data.org/76.png',
      'Wolves': 'https://crests.football-data.org/76.png',
      'Crystal Palace': 'https://crests.football-data.org/354.png',
      'Arsenal': 'https://crests.football-data.org/57.png',
      'Fulham': 'https://crests.football-data.org/63.png',
      'Newcastle United': 'https://crests.football-data.org/67.png',
      'Newcastle': 'https://crests.football-data.org/67.png',
      'Liverpool': 'https://crests.football-data.org/64.png',
      'Brentford': 'https://crests.football-data.org/402.png',
      'Manchester City': 'https://crests.football-data.org/65.png',
      'Man City': 'https://crests.football-data.org/65.png',
      'Aston Villa': 'https://crests.football-data.org/58.png',
      'Nottingham Forest': 'https://crests.football-data.org/351.png',
      'Nottingham': 'https://crests.football-data.org/351.png',
      'Bournemouth': 'https://crests.football-data.org/1044.png',
      'Sunderland': 'https://crests.football-data.org/71.png',
      'Chelsea': 'https://crests.football-data.org/61.png',
      'Tottenham Hotspur': 'https://crests.football-data.org/73.png',
      'Tottenham': 'https://crests.football-data.org/73.png',
      'Spurs': 'https://crests.football-data.org/73.png',
      'Everton': 'https://crests.football-data.org/62.png',
      'West Ham United': 'https://crests.football-data.org/563.png',
      'West Ham': 'https://crests.football-data.org/563.png',
      'Leeds United': 'https://crests.football-data.org/341.png',
      'Leeds': 'https://crests.football-data.org/341.png'
    };

    if (clubBadges[team]) return clubBadges[team];

    const teamLower = team.toLowerCase();
    for (const name in clubBadges) {
      if (teamLower.includes(name.toLowerCase()) || name.toLowerCase().includes(teamLower)) {
        return clubBadges[name];
      }
    }

    return `https://flagcdn.com/w80/${getCountryCode(team)}.png`;
  };

  const toggleMockMatch = (m: MockMatch) => {
    const exists = stagedMatches.find(sm => sm.homeTeam === m.homeTeam && sm.awayTeam === m.awayTeam && sm.startTime === m.startTime);
    if (exists) {
      setStagedMatches(stagedMatches.filter(sm => !(sm.homeTeam === m.homeTeam && sm.awayTeam === m.awayTeam && sm.startTime === m.startTime)));
    } else {
      // If first match, set an initial batch deadline based on that match
      if (stagedMatches.length === 0) {
        setBatchDeadline(format(new Date(m.startTime), "yyyy-MM-dd'T'HH:mm"));
      }
      setStagedMatches([...stagedMatches, { 
        ...m, 
        stagedHandicap: '0'
      }]);
    }
  };

  const handleBatchAdd = async () => {
    if (stagedMatches.length === 0) return;
    if (!batchDeadline) {
      alert('กรุณากำหนดเวลาปิดทายผล');
      return;
    }
    
    setResetLoading(true); 
    try {
      const batch = writeBatch(db);
      const deadlineDate = new Date(batchDeadline);
      
      for (const m of stagedMatches) {
        const matchRef = doc(collection(db, 'matches'));
        const date = new Date(m.startTime);
        
        batch.set(matchRef, {
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homeFlag: m.homeFlag,
          awayFlag: m.awayFlag,
          handicap: m.stagedHandicap,
          round: m.round,
          startTime: Timestamp.fromDate(date),
          predictionDeadline: Timestamp.fromDate(deadlineDate),
          status: MatchStatus.SCHEDULED,
          isPublished: false
        });
      }
      await batch.commit();
      setStagedMatches([]);
      setBatchDeadline('');
      setShowMockList(false);
      setShowAdd(false);
      alert('เพิ่มแมตช์ทั้งหมดเรียบร้อยแล้ว!');
    } catch (err) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการเพิ่มแบบกลุ่ม');
    } finally {
      setResetLoading(false);
    }
  };

  const handlePhotoUpload = async (userId: string, file: File) => {
    if (!file) return;
    
    // Check file size (rough check before resizing)
    if (file.size > 5 * 1024 * 1024) {
      alert('ไฟล์รูปภาพใหญ่เกินไป (จำกัด 5MB)');
      return;
    }

    setUploadingUid(userId);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          // Resize using canvas
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 300;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Convert to Base64
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          // Update Firestore
          await updateDoc(doc(db, 'users', userId), {
            photoURL: dataUrl
          });
          
          setUploadingUid(null);
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('Upload error:', err);
      alert('เกิดข้อผิดพลาดในการอัปโหลดรูปภาพ');
      setUploadingUid(null);
    }
  };

  const handleBatchCalculate = async () => {
    if (calcStagedIds.length === 0) return;
    
    // Validate all staged matches have scores and winner selections
    for (const id of calcStagedIds) {
      const hInput = document.getElementById(`home-${id}`) as HTMLInputElement;
      const aInput = document.getElementById(`away-${id}`) as HTMLInputElement;
      const h = hInput?.value;
      const a = aInput?.value;
      const winner = winners[id];

      if (!h || !a || !winner) {
        const match = matches.find(m => m.id === id);
        alert(`กรุณากรอกข้อมูลให้ครบสำหรับคู่ ${match?.homeTeam} vs ${match?.awayTeam}`);
        return;
      }
    }

    if (!window.confirm(`ยืนยันการคำนวณผล ${calcStagedIds.length} แมตช์?`)) return;

    setBatchLoading(true);
    try {
      for (const id of calcStagedIds) {
        const h = (document.getElementById(`home-${id}`) as HTMLInputElement).value;
        const a = (document.getElementById(`away-${id}`) as HTMLInputElement).value;
        const winner = winners[id];

        await updateDoc(doc(db, 'matches', id), {
          homeScore: Number(h),
          awayScore: Number(a),
          status: MatchStatus.FINISHED,
          manualWinner: winner
        });

        await calculateMatchResults(id);
      }
      setCalcStagedIds([]);
      alert('คำนวณผลสำเร็จทั้งหมดแล้ว!');
    } catch (err: any) {
      console.error(err);
      alert('เกิดข้อผิดพลาดในการคำนวณแบบกลุ่ม: ' + err.message);
    } finally {
      setBatchLoading(false);
    }
  };

  const toggleCalcStage = (id: string) => {
    if (calcStagedIds.includes(id)) {
      setCalcStagedIds(calcStagedIds.filter(i => i !== id));
    } else {
      setCalcStagedIds([...calcStagedIds, id]);
    }
  };

  const resetForm = () => {
    setEditingMatchId(null);
    setHomeTeam('');
    setAwayTeam('');
    setHandicap('0');
    setStartTime('');
    setPredictionDeadline('');
    setCustomWinScore('');
    setCustomLossScore('');
    setIsSpecialMatch(false);
  };

  const deleteMatch = async (id: string) => {
    if (window.confirm('ลบแมตช์นี้?')) {
      await deleteDoc(doc(db, 'matches', id));
    }
  };

  const setScores = async (matchId: string, home: number, away: number, manualWinner?: 'home' | 'away' | 'push') => {
    await updateDoc(doc(db, 'matches', matchId), {
      homeScore: home,
      awayScore: away,
      status: MatchStatus.FINISHED,
      manualWinner: manualWinner || null
    });
    
    setCalcLoading(matchId);
    await calculateMatchResults(matchId);
    setCalcLoading(null);
  };

  const renderConsensusSummary = (filteredMatches: Match[], title: string) => {
    if (editingMatchId !== null) return null;

    return (
      <div className="bg-slate-950/95 p-6 rounded-[2rem] border border-slate-800/80 shadow-2xl space-y-6 text-white mt-4">
        <div className="border-b border-slate-850 pb-3.5 flex justify-between items-center">
          <h3 className="text-base font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
            📊 {title}
          </h3>
          <span className="text-xs font-black bg-emerald-500/10 text-emerald-400 px-3.5 py-1 rounded-lg border border-emerald-500/20">
            จำนวน {filteredMatches.length} คู่
          </span>
        </div>

        {filteredMatches.length > 0 ? (
          <div className="divide-y divide-slate-800/80">
            {filteredMatches.map(m => {
              const matchPreds = allPredictions.filter(p => p.matchId === m.id);
              const homeCount = matchPreds.filter(p => p.choice === PredictionChoice.HOME).length;
              const awayCount = matchPreds.filter(p => p.choice === PredictionChoice.AWAY).length;
              const total = homeCount + awayCount;
              const homePercent = total > 0 ? Math.round((homeCount / total) * 100) : 0;
              const awayPercent = total > 0 ? Math.round((awayCount / total) * 100) : 0;

              // Round Name in Thai
              const roundNames: Record<string, string> = {
                'group': 'รอบแบ่งกลุ่ม',
                'top32': 'รอบ 32 ทีม',
                'top16': 'รอบ 16 ทีม',
                'top8': 'รอบ 8 ทีม',
                'top4': 'รอบรองชนะเลิศ',
                'third_place': 'ชิงอันดับ 3',
                'final': 'รอบชิงชนะเลิศ'
              };
              const roundThai = roundNames[m.round] || m.round;

              return (
                <div key={m.id} className="py-4 first:pt-0 last:pb-0 space-y-2.5">
                  {/* Match Title & Status */}
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-400 tracking-wider text-xs uppercase font-black">
                      {roundThai}
                    </span>
                    <span className={`text-[10px] sm:text-xs font-black uppercase px-2 py-0.5 rounded border ${
                      m.status === MatchStatus.FINISHED 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-slate-800 text-slate-200 border-slate-700/50'
                    }`}>
                      {m.status === MatchStatus.FINISHED ? `จบแล้ว (${m.homeScore}-${m.awayScore})` : 'ปิดทายแล้ว'}
                    </span>
                  </div>

                  {/* Graph Breakdown */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-4 text-xs sm:text-sm font-black">
                      {/* Home Team Details */}
                      <div className={`flex items-start gap-2 justify-start ${homeCount > awayCount ? 'text-emerald-400' : 'text-slate-200'}`}>
                        <img 
                          src={m.homeFlag} 
                          className="w-5 h-5 object-contain rounded-sm mt-0.5 shrink-0" 
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://flagcdn.com/w80/un.png'; }} 
                        />
                        <div className="flex flex-col items-start min-w-0">
                          <span className="break-words whitespace-normal leading-tight font-black">{m.homeTeam}</span>
                          <span className="font-mono text-[10px] sm:text-xs text-slate-400 mt-0.5">({homeCount} คน)</span>
                        </div>
                        {homeCount > awayCount && (
                          <Star className="w-4 h-4 text-emerald-400 fill-emerald-400 shrink-0 mt-0.5 animate-pulse" />
                        )}
                      </div>

                      {/* Away Team Details */}
                      <div className={`flex items-start gap-2 justify-end text-right ${awayCount > homeCount ? 'text-fuchsia-400' : 'text-slate-200'}`}>
                        {awayCount > homeCount && (
                          <Star className="w-4 h-4 text-fuchsia-400 fill-fuchsia-400 shrink-0 mt-0.5 animate-pulse" />
                        )}
                        <div className="flex flex-col items-end min-w-0">
                          <span className="break-words whitespace-normal leading-tight font-black">{m.awayTeam}</span>
                          <span className="font-mono text-[10px] sm:text-xs text-slate-400 mt-0.5">({awayCount} คน)</span>
                        </div>
                        <img 
                          src={m.awayFlag} 
                          className="w-5 h-5 object-contain rounded-sm mt-0.5 shrink-0" 
                          onError={(e) => { (e.target as HTMLImageElement).src = 'https://flagcdn.com/w80/un.png'; }} 
                        />
                      </div>
                    </div>

                    {/* Visual Vote Progress Bar */}
                    <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden flex border border-slate-900">
                      <div 
                        style={{ width: `${homePercent}%` }} 
                        className="h-full bg-gradient-to-r from-emerald-650 to-emerald-400 transition-all duration-500"
                      />
                      <div 
                        style={{ width: `${awayPercent}%` }} 
                        className="h-full bg-gradient-to-l from-fuchsia-650 to-fuchsia-400 transition-all duration-500"
                      />
                    </div>

                    {/* Percentage Labels */}
                    <div className="flex justify-between text-[10px] sm:text-xs font-black text-slate-400 tracking-widest px-0.5">
                      <span>{homePercent}% VOTE</span>
                      <span>{awayPercent}% VOTE</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-xs font-bold text-center text-slate-400 py-6 italic bg-slate-900/40 rounded-2xl border border-dashed border-slate-800">
            ยังไม่มีแมตช์ในส่วนนี้ขณะนี้
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="w-full">
          <div className="bg-slate-100/80 backdrop-blur-sm p-1.5 rounded-2xl flex w-full gap-1.5 shadow-inner border border-slate-200/50">
            <button 
              onClick={() => setActiveAdminTab('matches')}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 ${activeAdminTab === 'matches' ? 'bg-world-cup-green text-white shadow-md shadow-world-cup-green/20 scale-[1.02]' : 'text-slate-800 hover:text-black'}`}
            >
              แมตช์
            </button>
            <button 
              onClick={() => setActiveAdminTab('history')}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 ${activeAdminTab === 'history' ? 'bg-world-cup-green text-white shadow-md shadow-world-cup-green/20 scale-[1.02]' : 'text-slate-800 hover:text-black'}`}
            >
              ประวัติการทาย
            </button>
            <button 
              onClick={() => setActiveAdminTab('players')}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 ${activeAdminTab === 'players' ? 'bg-world-cup-green text-white shadow-md shadow-world-cup-green/20 scale-[1.02]' : 'text-slate-800 hover:text-black'}`}
            >
              ผู้เล่น
            </button>
            <button 
              onClick={() => setActiveAdminTab('custom')}
              className={`flex-1 text-center py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all duration-200 ${activeAdminTab === 'custom' ? 'bg-world-cup-green text-white shadow-md shadow-world-cup-green/20 scale-[1.02]' : 'text-slate-800 hover:text-black'}`}
            >
              ปรับแต่ง
            </button>
          </div>
        </div>

        {deferredAdminTab === 'matches' && (
          <div className="flex gap-2">
            <button 
              disabled={resetLoading || hardResetLoading}
              onClick={handleResetForKnockout}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-3 rounded-2xl text-[10px] uppercase font-bold disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${resetLoading ? 'animate-spin' : ''}`} />
              รีเซ็ตรอบ 16 ทีม
            </button>
            <button 
              onClick={() => setShowAdd(!showAdd)}
              className="flex-1 flex items-center justify-center gap-2 bg-world-cup-green text-white px-4 py-3 rounded-2xl text-[10px] uppercase font-bold"
            >
              {showAdd ? 'ยกเลิก' : <><PlusCircle className="w-3 h-3" /> เพิ่มแมตช์</>}
            </button>
            <button 
              onClick={() => setShowStatusModal(true)}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-3 rounded-2xl text-[10px] uppercase font-bold hover:bg-blue-500 transition-all shadow-md shadow-blue-600/20"
            >
              <ClipboardList className="w-3.5 h-3.5" /> สถานะการทาย
            </button>
            <button 
              disabled={calcPredsLoading}
              onClick={handleCalculatePredictions}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-2xl text-[10px] uppercase font-bold disabled:opacity-50 hover:bg-emerald-500 transition-all shadow-md shadow-emerald-600/20"
            >
              {calcPredsLoading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Zap className="w-3.5 h-3.5" />
              )}
              คำนวณผลการทาย
            </button>
            <button 
              onClick={async () => {
                if (window.confirm('⚠️ ลบแมตช์ทั้งหมด? ข้อมูลการทายผลที่เกี่ยวข้องจะหายไปด้วย')) {
                  const matchSnap = await getDocs(collection(db, 'matches'));
                  const batch = writeBatch(db);
                  matchSnap.forEach(d => batch.delete(d.ref));
                  await batch.commit();
                  alert('ลบข้อมูลแมตช์ทั้งหมดแล้ว');
                }
              }}
              className="px-4 bg-red-100 text-red-500 rounded-2xl p-2 hover:bg-red-500 hover:text-white transition-all shadow-sm"
              title="Delete All Matches"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button 
              onClick={async () => {
                if (window.confirm('ต้องการเพิ่มแมตช์จริงจากตาราง World Cup 2026 หรือไม่?')) {
                  const batch = writeBatch(db);
                  const seenIds = new Set<string>();
                  let addedCount = 0;

                  for (const m of WORLD_CUP_2026_SCHEDULE) {
                    const startMs = new Date(m.startTime).getTime();
                    const matchId = `${m.homeTeam.replace(/\s+/g, '_')}_${m.awayTeam.replace(/\s+/g, '_')}_${startMs}`;

                    if (seenIds.has(matchId)) continue;
                    seenIds.add(matchId);
                    addedCount++;

                    const matchRef = doc(db, 'matches', matchId);
                    batch.set(matchRef, {
                      id: matchId,
                      ...m,
                      startTime: Timestamp.fromDate(new Date(m.startTime)),
                      predictionDeadline: Timestamp.fromDate(new Date(new Date(m.startTime).getTime() - 3600000)),
                      status: MatchStatus.SCHEDULED,
                      handicap: '0.0',
                      isPublished: false
                    });
                  }
                  await batch.commit();
                  alert(`เพิ่ม/อัปเดตข้อมูลแมตช์สำเร็จจำนวน ${addedCount} คู่!`);
                }
              }}
              className="px-4 bg-blue-100 text-blue-600 rounded-2xl p-2 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
              title="Add Real Schedule"
            >
              <Zap className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>

      {/* System Actions Area */}
      {deferredAdminTab === 'matches' && (
        <>
          <div className="wc-glass p-4 rounded-2xl border border-red-500/10 bg-red-50">
            <button 
              disabled={hardResetLoading}
              onClick={handleHardReset}
              className="w-full flex items-center justify-center gap-2 text-red-500 text-xs uppercase font-black tracking-tighter hover:text-red-600 transition-all disabled:opacity-50"
            >
              {hardResetLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              ล้างข้อมูลทั้งหมด (Clean Start) • เฉพาะแอดมินใจเด็ด
            </button>
          </div>

          {/* Consolidated Closed Match Vote Graphs Card */}
          {(() => {
            const nowTime = new Date();
            const closedMatches = matches.filter(m => {
              const deadline = m.predictionDeadline ? new Date(m.predictionDeadline.seconds * 1000) : new Date(m.startTime.seconds * 1000);
              const isClosed = deadline.getTime() < nowTime.getTime() || m.status === MatchStatus.FINISHED;
              if (!isClosed) return false;
              
              if (m.status === MatchStatus.FINISHED) {
                const finishedTimeLimit = m.startTime.seconds * 1000 + 24 * 60 * 60 * 1000;
                if (nowTime.getTime() > finishedTimeLimit) {
                  return false; // Move to history
                }
              }
              return true;
            });
            const sortedClosedMatches = [...closedMatches]
              .sort((a, b) => b.startTime.seconds - a.startTime.seconds)
              .slice(0, 6);

            return renderConsensusSummary(sortedClosedMatches, 'สรุปกราฟผลโหวตล่าสุด (Consensus Summary)');
          })()}
        </>
      )}

      {deferredAdminTab === 'history' && (
        <>
          {/* Consolidated Closed Match Vote Graphs Card for History (Finished > 24 hours) */}
          {(() => {
            const nowTime = new Date();
            const historyMatches = matches.filter(m => {
              const isFinished = m.status === MatchStatus.FINISHED;
              if (!isFinished) return false;
              
              const finishedTimeLimit = m.startTime.seconds * 1000 + 24 * 60 * 60 * 1000;
              return nowTime.getTime() > finishedTimeLimit;
            });
            const sortedHistoryMatches = [...historyMatches].sort((a, b) => b.startTime.seconds - a.startTime.seconds);

            return renderConsensusSummary(sortedHistoryMatches, 'สรุปกราฟผลโหวตประวัติการแข่งขัน (Consensus Summary History)');
          })()}
        </>
      )}

      {deferredAdminTab === 'players' && (
        <div className="space-y-6">
          <div className="wc-glass p-6 rounded-3xl border-t-2 border-world-cup-green/20">
            <h3 className="text-sm text-black italic uppercase tracking-wider mb-2 text-center underline underline-offset-4 font-black">สรุปรายชื่อเพื่อนซี้</h3>
            <p className="text-[10px] text-center text-black mb-4 font-black">ผู้เล่นสมัครสมาชิกเองผ่านหน้าลงทะเบียน</p>
            
            <div className="flex flex-col md:flex-row justify-center items-center gap-6 mb-6">
              <button 
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-2xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer border border-emerald-500/30 w-full md:w-auto justify-center"
              >
                📥 Export สถิติการทายรอบแรก (Excel / CSV)
              </button>

              <div className="flex items-center gap-2.5 p-3 bg-slate-950/20 rounded-2xl border border-white/5 w-full md:w-auto justify-center">
                <span className="text-xs font-black text-black whitespace-nowrap">ผลโหวตรายวัน:</span>
                <select
                  value={selectedMatchDate}
                  onChange={(e) => setSelectedMatchDate(e.target.value)}
                  className="bg-white border border-gray-250 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-world-cup-green/50 cursor-pointer min-w-[110px]"
                >
                  {(() => {
                    const matchDates = Array.from(new Set(matches.map(m => {
                      const formatted = formatInThailandTime(m.startTime, 'dd/MM/yyyy HH:mm');
                      return formatted ? formatted.slice(0, 10) : '';
                    }).filter(d => d !== '')));
                    
                    matchDates.sort((a, b) => {
                      const [dayA, monthA, yearA] = a.split('/');
                      const [dayB, monthB, yearB] = b.split('/');
                      const dateA = new Date(Number(yearA), Number(monthA) - 1, Number(dayA));
                      const dateB = new Date(Number(yearB), Number(monthB) - 1, Number(dayB));
                      return dateA.getTime() - dateB.getTime();
                    });

                    if (matchDates.length === 0) {
                      return <option value="">ไม่มีข้อมูลวันแข่ง</option>;
                    }

                    return matchDates.map(dateStr => (
                      <option key={dateStr} value={dateStr}>
                        วันที่ {dateStr}
                      </option>
                    ));
                  })()}
                </select>
                <button
                  type="button"
                  onClick={() => handleExportDailyVotesSummary(selectedMatchDate)}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-black shadow-md shadow-emerald-600/20 active:scale-95 transition-all cursor-pointer border border-emerald-500/30 whitespace-nowrap"
                >
                  📥 โหลดผลโหวตในวัน
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              {users.map((u, idx) => (
                <div key={u.uid} className="wc-glass p-5 rounded-2xl flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-world-cup-green/10 flex items-center justify-center text-sm text-world-cup-green font-bold border border-world-cup-green/20">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-huge text-black font-black">{u.displayName}</p>
                        {u.personalPin && (
                          <span className="text-[10px] bg-amber-50 text-world-cup-gold border border-amber-200 px-2 py-0.5 rounded-lg font-black tracking-widest flex items-center gap-1 select-all">
                            🔑 {u.personalPin}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-black font-bold">{u.role === 'admin' ? 'แอดมิน' : 'ผู้เล่น'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-huge text-world-cup-gold font-black">{u.points}</p>
                      <p className="text-[10px] text-black uppercase font-black tracking-widest">POINTS</p>
                    </div>
                    {u.role !== 'admin' && (
                      <div className="flex flex-col gap-1.5 shrink-0 ml-2">
                        {manOfTheNight?.userId === u.uid ? (
                          <>
                            <span className="text-[9px] bg-yellow-400 text-black px-2.5 py-1 rounded-lg font-black text-center animate-pulse border border-yellow-350 shadow-[0_0_8px_rgba(250,204,21,0.5)] flex items-center justify-center gap-1">
                              <Star className="w-2.5 h-2.5 fill-current text-black" />
                              MAN OF THE NIGHT
                            </span>
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => handleSelectManOfTheNight(u.uid)}
                                className="bg-slate-900 hover:bg-black text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                              >
                                ยิงซ้ำ
                              </button>
                              <button
                                onClick={handleClearManOfTheNight}
                                className="bg-red-650 hover:bg-red-700 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                              >
                                ปลด
                              </button>
                            </div>
                          </>
                        ) : (
                          <button
                            onClick={() => handleSelectManOfTheNight(u.uid)}
                            className="bg-world-cup-gold hover:bg-yellow-600 text-black px-2.5 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all"
                          >
                            ตั้งเป็น Man of the Night
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="wc-glass p-6 rounded-3xl border-t-2 border-world-cup-gold/20">
            <div className="flex items-center gap-2 justify-center mb-1">
              <Zap className="w-4 h-4 text-world-cup-gold animate-bounce" />
              <h3 className="text-sm font-black text-black italic uppercase tracking-wider">สถานะการใช้งานรหัสผ่าน (PIN Status Explorer)</h3>
            </div>
            <p className="text-[10px] text-center text-black mb-6 font-bold">เฉพาะแอดมินเท่านั้นที่จะมองเห็นส่วนนี้ เพื่อใช้สุ่มรหัสผ่านแจกจ่ายให้เพื่อนๆ</p>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-3">
              {PLAYER_PINS.map((playerPin) => {
                const occupier = users.find(u => u.personalPin === playerPin);
                const isOccupied = !!occupier;

                return (
                  <div
                    key={playerPin}
                    className={`p-3.5 rounded-2xl border flex flex-col justify-center items-center gap-1.5 transition-all text-center ${
                      isOccupied 
                        ? 'bg-slate-100 border-slate-200 text-slate-800 font-black' 
                        : 'bg-white border-slate-200 hover:border-world-cup-green/40 shadow-sm'
                    }`}
                  >
                    <span className={`text-sm font-black tracking-widest ${isOccupied ? 'line-through text-slate-600' : 'text-world-cup-gold text-base'}`}>
                      {playerPin}
                    </span>
                    <span className="text-[10px] font-bold block max-w-full truncate">
                      {isOccupied ? (
                        <span className="text-red-600 font-black">🔒 {occupier.displayName}</span>
                      ) : (
                        <span className="text-world-cup-green font-black">🟢 ว่าง</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {deferredAdminTab === 'custom' && (
        <div className="space-y-6">
          <div className="wc-glass p-8 rounded-[2rem] border-t-8 border-world-cup-gold shadow-xl space-y-8">
            <div className="text-center space-y-2">
              <h3 className="text-xl italic font-black uppercase tracking-widest text-black">APP CUSTOMIZATION</h3>
              <p className="text-xs text-black font-black uppercase tracking-tighter">ปรับโฉมสนามในพริบตา</p>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {/* Logo Customization */}
              <div className="space-y-4">
                <label className="text-xs font-black text-black uppercase tracking-widest block text-center">โลโก้แอป (Logo)</label>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 bg-gray-50 border-4 border-dashed border-gray-200 rounded-3xl flex items-center justify-center overflow-hidden">
                    {appConfig?.logoUrl ? (
                      <img src={appConfig.logoUrl} className="w-full h-full object-contain" />
                    ) : (
                      <PlusCircle className="w-10 h-10 text-gray-450" />
                    )}
                  </div>
                  <label className="cursor-pointer bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
                    {configSaving ? 'กำลังอัปโหลด...' : 'เปลี่ยนโลโก้'}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleConfigUpload('logo', e.target.files[0])}
                    />
                  </label>
                </div>
              </div>

              {/* Background Customization */}
              <div className="space-y-4">
                <label className="text-xs font-black text-black uppercase tracking-widest block text-center">พื้นหลังแอป (Background)</label>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full aspect-video bg-gray-50 border-4 border-dashed border-gray-200 rounded-3xl flex items-center justify-center overflow-hidden relative">
                    {appConfig?.backgroundUrl ? (
                      <img src={appConfig.backgroundUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-black text-center font-black italic">
                        <Camera className="w-12 h-12 mx-auto mb-2 opacity-50 text-black" />
                        NO CUSTOM BACKGROUND
                      </div>
                    )}
                  </div>
                  <label className="cursor-pointer bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all">
                    {configSaving ? 'กำลังอัปโหลด...' : 'เปลี่ยนพื้นหลัง'}
                    <input 
                      type="file" 
                      className="hidden" 
                      accept="image/*"
                      onChange={(e) => e.target.files?.[0] && handleConfigUpload('background', e.target.files[0])}
                    />
                  </label>
                </div>
              </div>
            </div>

            <div className="pt-4 flex flex-col gap-3">
              <button 
                onClick={handleResetConfig}
                className="w-full py-4 text-xs font-bold text-black uppercase tracking-widest hover:text-red-500 transition-all border border-gray-300 rounded-2xl"
              >
                คืนค่าเริ่มต้นทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {(deferredAdminTab === 'matches' || deferredAdminTab === 'history') && (
        <>
          {showAdd && (
            <div className="space-y-4 max-w-3xl mx-auto">
              <div className="flex items-center justify-between px-2">
                <h3 className="text-xl font-black text-slate-800 italic uppercase">
                  {editingMatchId ? 'แก้ไขแมตช์' : 'เพิ่มแมตช์ใหม่'}
                </h3>
                {editingMatchId && (
                  <button onClick={resetForm} className="text-xs font-bold text-red-500 uppercase underline">
                    ยกเลิกการแก้ไข
                  </button>
                )}
              </div>


              <form onSubmit={handleAddMatch} className="space-y-6">
                {/* Excel Import Section - Rendered as a nice, clean card on both mobile and desktop */}
                {!editingMatchId && (
                  <div className="wc-glass p-6 rounded-3xl border-t-4 border-slate-700 shadow-2xl">
                    <div className="flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-black text-black uppercase tracking-widest ml-4">นำเข้าจาก Excel / Google Sheets</label>
                        <div className="flex gap-4 items-center">
                          <label className="cursor-pointer text-[10px] font-black text-blue-500 uppercase flex items-center gap-1 hover:underline">
                            <FileUp className="w-3 h-3" /> เลือกไฟล์ .xlsx
                            <input 
                              type="file" 
                              className="hidden" 
                              accept=".xlsx, .xls, .csv" 
                              onChange={(e) => e.target.files?.[0] && handleExcelImport(e.target.files[0])}
                            />
                          </label>
                          <button 
                            type="button"
                            onClick={() => {
                              setBulkText("France | Senegal | -0.5 | 2026-06-19 20:00\nArgentina | Italy | +0.25 | 2026-06-20 18:00");
                            }}
                            className="text-[10px] font-black text-world-cup-gold uppercase underline"
                          >
                            ดูตัวอย่าง
                          </button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <textarea 
                          placeholder="Copy คอลัมน์จาก Excel แล้วมา 'วาง' (Paste) ที่นี่ได้เลยครับ..."
                          className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 lg:p-3 text-xs font-bold text-black focus:border-world-cup-green focus:outline-none min-h-[120px]"
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                        />
                        {bulkText.trim() && (
                          <button 
                            type="button"
                            onClick={handleBulkImportText}
                            disabled={batchLoading}
                            className="w-full bg-slate-800 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center justify-center gap-2"
                          >
                            {batchLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle className="w-3 h-3" />}
                            ดำเนินการเพิ่ม {bulkText.split('\n').filter(l => l.trim()).length} คู่
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* 1. Mobile Form View (lg:hidden) */}
                <div className="lg:hidden wc-glass p-8 rounded-3xl space-y-6 border-t-4 border-world-cup-gold shadow-2xl">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs text-black font-black uppercase tracking-widest">ทีม 1 (Team 1)</label>
                      <input required value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge text-black font-black focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" placeholder="เช่น Argentina" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-black font-black uppercase tracking-widest">ทีม 2 (Team 2)</label>
                      <input required value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge text-black font-black focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" placeholder="เช่น France" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs text-black font-black uppercase tracking-widest">ราคาต่อรอง (Handicap)</label>
                      <input type="text" required value={handicap} onChange={e => setHandicap(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge text-black font-black focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" placeholder="เช่น 0.5 หรือ 0.5/1" title="เป็นราคาต่อรองของฝั่งเจ้าบ้าน" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-black font-black uppercase tracking-widest">รอบการแข่งขัน</label>
                      <select value={round} onChange={e => setRound(e.target.value as TournamentRound)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge text-black font-black focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all">
                        <option value={TournamentRound.GROUP}>รอบแบ่งกลุ่ม</option>
                        <option value={TournamentRound.TOP32}>รอบ 32 ทีม</option>
                        <option value={TournamentRound.TOP16}>รอบ 16 ทีม</option>
                        <option value={TournamentRound.TOP8}>รอบ 8 ทีม</option>
                        <option value={TournamentRound.TOP4}>รอบรองชนะเลิศ</option>
                        <option value={TournamentRound.THIRD_PLACE}>ชิงอันดับ 3</option>
                        <option value={TournamentRound.FINAL}>รอบชิงชนะเลิศ</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs text-black font-black uppercase tracking-widest">เวลาแข่งขัน (Start Time)</label>
                      <input type="datetime-local" required value={startTime} onChange={e => handleStartTimeChange(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge text-black font-black focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs text-black font-black uppercase tracking-widest">ปิดทายผล (Deadline)</label>
                      <input type="datetime-local" required value={predictionDeadline} onChange={e => setPredictionDeadline(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge text-black font-black focus:outline-none focus:ring-2 focus:ring-world-cup-gold/20 focus:border-world-cup-gold transition-all" />
                    </div>
                  </div>

                  <div className="p-6 rounded-2xl border-2 border-dashed border-gray-100 space-y-4">
                    <label className="flex items-center gap-3 cursor-pointer group">
                      <div 
                        onClick={() => setIsSpecialMatch(!isSpecialMatch)}
                        className={`w-12 h-6 rounded-full transition-all relative ${isSpecialMatch ? 'bg-red-500' : 'bg-gray-200'}`}
                      >
                        <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${isSpecialMatch ? 'translate-x-6' : ''}`} />
                      </div>
                      <span className="text-sm font-black text-black uppercase tracking-widest">เปิดระบบคะแนนพิเศษ (คู่เอก)</span>
                    </label>

                    {isSpecialMatch && (
                      <motion.div 
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="grid grid-cols-2 gap-4 pt-2"
                      >
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-red-500 uppercase tracking-widest">คะแนนทายถูก (+)</label>
                          <input 
                            type="number" 
                            value={customWinScore} 
                            onChange={e => setCustomWinScore(e.target.value)} 
                            placeholder="เช่น 10" 
                            className="w-full bg-white border-2 border-red-500/20 rounded-xl p-4 text-huge font-black text-black focus:border-red-500 focus:outline-none transition-all"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-black uppercase tracking-widest">คะแนนทายผิด (-)</label>
                          <input 
                            type="number" 
                            value={customLossScore} 
                            onChange={e => setCustomLossScore(e.target.value)} 
                            placeholder="เช่น -5" 
                            className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 text-huge font-black text-black focus:border-slate-500 focus:outline-none transition-all"
                          />
                        </div>
                      </motion.div>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={matchSaving}
                    className="w-full bg-world-cup-green text-white py-5 rounded-2xl font-black uppercase text-huge shadow-lg shadow-world-cup-green/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {matchSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : (editingMatchId ? 'ตกลงแก้ไขข้อมูล' : 'บันทึกข้อมูลแมตช์')}
                  </button>
                </div>

                {/* 2. Desktop Table Form View (hidden lg:block) */}
                <div className="hidden lg:block wc-glass p-6 rounded-[2rem] border border-gray-250/50 shadow-2xl space-y-4 text-slate-800">
                  <div className="flex justify-between items-center px-1">
                    <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest">
                      กรอกข้อมูลแมตช์ (Table Form)
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse text-left min-w-[900px]">
                      <thead>
                        <tr className="border-b border-gray-200 text-[8px] font-black text-slate-500 uppercase tracking-widest">
                          <th className="pb-3 pr-3 w-[20%]">ทีมเหย้า (Team 1)</th>
                          <th className="pb-3 pr-3 w-[20%]">ทีมเยือน (Team 2)</th>
                          <th className="pb-3 pr-3 w-[12%]">ราคาบอล (Handicap)</th>
                          <th className="pb-3 pr-3 w-[15%]">รอบการแข่งขัน (Round)</th>
                          <th className="pb-3 pr-3 w-[16%]">เวลาแข่งขัน (Start Time)</th>
                          <th className="pb-3 pr-3 w-[16%]">ปิดทายผล (Deadline)</th>
                          <th className="pb-3 w-[15%]">คู่เอก (คะแนนพิเศษ)</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="py-3 pr-3 align-middle">
                            <input 
                              required 
                              value={homeTeam} 
                              onChange={e => setHomeTeam(e.target.value)} 
                              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                              placeholder="เช่น Belgium" 
                            />
                          </td>
                          <td className="py-3 pr-3 align-middle">
                            <input 
                              required 
                              value={awayTeam} 
                              onChange={e => setAwayTeam(e.target.value)} 
                              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                              placeholder="เช่น Egypt" 
                            />
                          </td>
                          <td className="py-3 pr-3 align-middle">
                            <input 
                              type="text" 
                              required 
                              value={handicap} 
                              onChange={e => setHandicap(e.target.value)} 
                              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                              placeholder="เช่น 0.0" 
                            />
                          </td>
                          <td className="py-3 pr-3 align-middle">
                            <select 
                              value={round} 
                              onChange={e => setRound(e.target.value as TournamentRound)} 
                              className="w-full bg-white border border-gray-300 rounded-lg p-2 text-xs font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            >
                              <option value={TournamentRound.GROUP}>รอบแบ่งกลุ่ม</option>
                              <option value={TournamentRound.TOP32}>รอบ 32 ทีม</option>
                              <option value={TournamentRound.TOP16}>รอบ 16 ทีม</option>
                              <option value={TournamentRound.TOP8}>รอบ 8 ทีม</option>
                              <option value={TournamentRound.TOP4}>รอบรองชนะเลิศ</option>
                              <option value={TournamentRound.THIRD_PLACE}>ชิงอันดับ 3</option>
                              <option value={TournamentRound.FINAL}>รอบชิงชนะเลิศ</option>
                            </select>
                          </td>
                          <td className="py-3 pr-3 align-middle">
                            <input 
                              type="datetime-local" 
                              required 
                              value={startTime} 
                              onChange={e => handleStartTimeChange(e.target.value)} 
                              className="w-full bg-white border border-gray-300 rounded-lg p-1.5 text-[10px] font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </td>
                          <td className="py-3 pr-3 align-middle">
                            <input 
                              type="datetime-local" 
                              required 
                              value={predictionDeadline} 
                              onChange={e => setPredictionDeadline(e.target.value)} 
                              className="w-full bg-white border border-gray-300 rounded-lg p-1.5 text-[10px] font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500" 
                            />
                          </td>
                          <td className="py-3 align-middle">
                            <div className="flex flex-col gap-1.5">
                              <select 
                                value={isSpecialMatch ? 'special' : 'normal'} 
                                onChange={e => {
                                  const val = e.target.value === 'special';
                                  setIsSpecialMatch(val);
                                  if (val) {
                                    setCustomWinScore('5');
                                    setCustomLossScore('-3');
                                  } else {
                                    setCustomWinScore('');
                                    setCustomLossScore('');
                                  }
                                }}
                                className="w-full bg-white border border-gray-300 rounded-lg p-1.5 text-[10px] font-bold text-black focus:outline-none focus:ring-1 focus:ring-emerald-500"
                              >
                                <option value="normal">ปกติ</option>
                                <option value="special">คู่เอก</option>
                              </select>
                              {isSpecialMatch && (
                                <div className="flex gap-1 justify-center">
                                  <input 
                                    type="number" 
                                    placeholder="ถูก" 
                                    value={customWinScore} 
                                    onChange={e => setCustomWinScore(e.target.value)} 
                                    className="w-10 bg-white border border-red-300 rounded-lg p-1 text-center text-[10px] font-black text-red-600 focus:outline-none" 
                                    title="คะแนนทายถูก" 
                                  />
                                  <input 
                                    type="number" 
                                    placeholder="ผิด" 
                                    value={customLossScore} 
                                    onChange={e => setCustomLossScore(e.target.value)} 
                                    className="w-10 bg-white border border-gray-300 rounded-lg p-1 text-center text-[10px] font-black text-slate-600 focus:outline-none" 
                                    title="คะแนนทายผิด" 
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="flex justify-end gap-3 pt-3.5 border-t border-gray-200">
                    <button 
                      type="button" 
                      onClick={resetForm} 
                      className="px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider text-slate-700 hover:text-slate-900 transition-all bg-slate-100 hover:bg-slate-200 border border-gray-300 cursor-pointer"
                    >
                      ยกเลิก
                    </button>
                    <button 
                      type="submit" 
                      disabled={matchSaving}
                      className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider bg-world-cup-green text-white hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-world-cup-green/10 cursor-pointer"
                    >
                      {matchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : (editingMatchId ? 'บันทึกการแก้ไข' : 'บันทึกแมตช์ใหม่')}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

        {!showAdd && (
          <div className="space-y-6">
            {deferredAdminTab === 'matches' && calcStagedIds.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="wc-glass p-6 rounded-[2rem] border-2 border-world-cup-gold bg-world-cup-gold/5 sticky top-4 z-40 shadow-2xl backdrop-blur-xl space-y-4"
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-world-cup-gold rounded-full flex items-center justify-center text-white shadow-lg">
                      <CheckCircle className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-black uppercase tracking-widest">BATCH CALCULATION</h3>
                      <p className="text-[10px] text-black font-black uppercase tracking-tight">เลือกแล้ว {calcStagedIds.length} คู่</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setCalcStagedIds([])}
                    className="text-gray-400 hover:text-red-500 text-[10px] font-black uppercase tracking-widest bg-gray-100 px-3 py-1 rounded-full"
                  >
                    ล้างที่เลือก
                  </button>
                </div>

                {/* Compact List of Selected Matches */}
                <div className="max-h-32 overflow-y-auto no-scrollbar py-2 border-y border-world-cup-gold/10 space-y-2">
                  {calcStagedIds.map(id => {
                    const match = matches.find(m => m.id === id);
                    const h = (document.getElementById(`home-${id}`) as HTMLInputElement)?.value || '?';
                    const a = (document.getElementById(`away-${id}`) as HTMLInputElement)?.value || '?';
                    const winner = winners[id];
                    
                    return (
                      <div key={id} className="flex justify-between items-center text-[11px] font-bold bg-white/50 px-3 py-2 rounded-xl">
                        <span className="text-slate-700 truncate max-w-[120px]">{match?.homeTeam} vs {match?.awayTeam}</span>
                        <div className="flex items-center gap-2">
                          <span className="bg-slate-800 text-white px-2 py-0.5 rounded-lg">{h} - {a}</span>
                          {winner && (
                            <span className={`px-2 py-0.5 rounded-lg text-white ${winner === 'home' ? 'bg-world-cup-green' : winner === 'away' ? 'bg-blue-500' : 'bg-amber-500'}`}>
                              {winner === 'home' ? 'H' : winner === 'away' ? 'A' : 'P'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <button 
                  disabled={batchLoading}
                  onClick={handleBatchCalculate}
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl text-huge font-black flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  {batchLoading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-world-cup-gold" />
                  ) : (
                    <>
                      <RefreshCw className="w-5 h-5 text-world-cup-gold" />
                      คำนวณผลทั้งหมด ({calcStagedIds.length} คู่)
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {matches.filter(match => {
              if (deferredAdminTab === 'history') {
                return match.status === MatchStatus.FINISHED;
              }
              return match.status !== MatchStatus.FINISHED;
            }).length === 0 ? (
              <div className="wc-glass p-8 rounded-2xl text-center text-black font-black italic">
                ไม่มีแมตช์ในส่วนนี้
              </div>
            ) : (
              <>
                {/* 1. Mobile Card View */}
                <div className="lg:hidden space-y-6">
                  {matches.filter(match => {
                    if (deferredAdminTab === 'history') {
                      return match.status === MatchStatus.FINISHED;
                    }
                    return match.status !== MatchStatus.FINISHED;
                  }).map(match => (
                  <div key={match.id} className={`wc-glass rounded-3xl p-6 flex flex-col gap-6 border-l-8 transition-all ${calcStagedIds.includes(match.id) ? 'border-world-cup-gold bg-world-cup-gold/5 ring-2 ring-world-cup-gold/20' : 'border-world-cup-green shadow-xl'}`}>
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3 flex-1">
                        {match.status !== MatchStatus.FINISHED && (
                          <button 
                            onClick={() => toggleCalcStage(match.id)}
                            className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${calcStagedIds.includes(match.id) ? 'bg-world-cup-gold border-world-cup-gold text-white' : 'border-gray-200'}`}
                          >
                            {calcStagedIds.includes(match.id) && <Check className="w-3.5 h-3.5 font-black" />}
                          </button>
                        )}
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-bold text-world-cup-green uppercase tracking-widest">
                              {match.round === TournamentRound.GROUP && 'รอบแบ่งกลุ่ม'}
                              {match.round === TournamentRound.TOP32 && 'รอบ 32 ทีม'}
                              {match.round === TournamentRound.TOP16 && 'รอบ 16 ทีม'}
                              {match.round === TournamentRound.TOP8 && 'รอบ 8 ทีม'}
                              {match.round === TournamentRound.TOP4 && 'รอบรองชนะเลิศ'}
                              {match.round === TournamentRound.THIRD_PLACE && 'ชิงอันดับ 3'}
                              {match.round === TournamentRound.FINAL && 'รอบชิงชนะเลิศ'}
                            </p>
                            {!match.isPublished && (
                              <span className="bg-slate-800 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-widest animate-pulse">
                                ดรอฟต์
                              </span>
                            )}
                          </div>
                          <h3 className="text-xl font-black text-black">{match.homeTeam} vs {match.awayTeam}</h3>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-black">{formatInThailandTime(match.startTime, 'dd/MM/yyyy HH:mm')}</span>
                            <div className="flex items-center gap-1 bg-world-cup-green/10 px-2 py-0.5 rounded border border-world-cup-green/20">
                              <span className="text-[8px] font-black text-black uppercase tracking-tighter">ราคา:</span>
                              <span className="text-world-cup-green text-[11px] font-black">{match.handicap}</span>
                            </div>
                            {match.customWinScore !== undefined && match.customWinScore !== null && (
                              <div className="bg-red-500 text-white px-2 py-0.5 rounded-lg text-[10px] font-black uppercase flex flex-col items-center justify-center min-w-[55px] shadow-sm border border-red-400">
                                <span className="leading-tight">คู่เอก</span>
                                <span className="leading-tight">(+{match.customWinScore}/{match.customLossScore})</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 ml-2">
                        <button 
                          onClick={async () => {
                            await updateDoc(doc(db, 'matches', match.id), {
                              isPublished: !match.isPublished
                            });
                          }}
                          className={`p-1 rounded-md transition-all ${match.isPublished ? 'bg-green-50 text-green-500 hover:bg-green-100' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}
                          title={match.isPublished ? "ซ่อน" : "แสดง"}
                        >
                          <CheckCircle className={`w-3.5 h-3.5 ${match.isPublished ? 'fill-current' : ''}`} />
                        </button>
                        <button 
                          onClick={() => handleEditMatch(match)}
                          className="p-1 rounded-md bg-blue-50 text-blue-500 hover:bg-blue-100 transition-all shadow-sm"
                          title="แก้ไข"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={async () => {
                            const isSpecial = match.customWinScore !== undefined && match.customWinScore !== null;
                            if (isSpecial) {
                              await updateDoc(doc(db, 'matches', match.id), {
                                customWinScore: null,
                                customLossScore: null
                              });
                            } else {
                              await updateDoc(doc(db, 'matches', match.id), {
                                customWinScore: 5,
                                customLossScore: -3
                              });
                            }
                          }}
                          className={`p-1 rounded-md transition-all ${match.customWinScore !== undefined && match.customWinScore !== null ? 'bg-world-cup-gold text-white shadow-lg' : 'bg-white border border-gray-100 text-gray-400 hover:bg-gray-50'}`}
                          title="ไฮไลท์"
                        >
                          <Star className={`w-3.5 h-3.5 ${match.customWinScore !== undefined && match.customWinScore !== null ? 'fill-current' : ''}`} />
                        </button>
                        <button 
                          onClick={() => deleteMatch(match.id)} 
                          className="p-1 rounded-md text-red-100 bg-red-50 hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {match.status !== MatchStatus.FINISHED ? (
                      <div className="space-y-6">
                        {/* Prediction Status Control */}
                        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100 shadow-inner">
                          <div className="space-y-1">
                            <span className="text-xs font-black text-black uppercase tracking-widest block">สิทธิ์การทายผลจากผู้เล่น</span>
                            <p className="text-[10px] text-slate-500 font-bold">
                              {match.allowPredictions 
                                ? 'เปิดให้ผู้เล่นทายผลอยู่ (สมาชิกส่งคำทำนายได้ตามปกติ)' 
                                : 'ปิดกั้นการทายผลอยู่ (สมาชิกเห็นข้อมูลแต่ยังทายไม่ได้)'}
                            </p>
                          </div>
                          <button 
                            onClick={async () => {
                              await updateDoc(doc(db, 'matches', match.id), {
                                allowPredictions: !match.allowPredictions
                              });
                            }}
                            className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer select-none flex items-center gap-2 shadow-sm ${
                              match.allowPredictions 
                                ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600 shadow-emerald-500/20' 
                                : 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600 shadow-rose-500/20'
                            }`}
                          >
                            {match.allowPredictions ? (
                              <>
                                <span className="w-2.5 h-2.5 rounded-full bg-white animate-pulse" />
                                <span>เปิดทายผลแล้ว</span>
                              </>
                            ) : (
                              <>
                                <span className="w-2.5 h-2.5 rounded-full bg-white" />
                                <span>คลิกเพื่อเปิดทาย</span>
                              </>
                            )}
                          </button>
                        </div>

                        <div className="flex items-center justify-center gap-6 py-4 bg-gray-50 rounded-2xl border border-gray-100">
                          <div className="text-center space-y-2">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest">Team 1</label>
                            <input id={`home-${match.id}`} type="number" placeholder="-" className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl text-center text-2xl font-black text-black focus:border-world-cup-green focus:outline-none transition-all shadow-inner" />
                          </div>
                          <div className="text-3xl font-black text-black self-end mb-3">:</div>
                          <div className="text-center space-y-2">
                            <label className="text-[10px] font-black text-black uppercase tracking-widest">Team 2</label>
                            <input id={`away-${match.id}`} type="number" placeholder="-" className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl text-center text-2xl font-black text-black focus:border-world-cup-green focus:outline-none transition-all shadow-inner" />
                          </div>
                        </div>

                        <div className="space-y-3">
                          <label className="text-xs font-black text-black uppercase tracking-widest block text-center">ใครชนะในราคาต่อรอง? (Handicap Winner)</label>
                          <div className="grid grid-cols-3 gap-3">
                            <button 
                              onClick={() => setWinners({...winners, [match.id]: 'home'})}
                              className={`py-4 rounded-xl text-sm font-black border-2 transition-all ${winners[match.id] === 'home' ? 'bg-world-cup-green border-world-cup-green text-white shadow-lg' : 'bg-white border-gray-200 text-slate-800 hover:border-world-cup-green/50'}`}
                            >
                              ทีม 1 ชนะ
                            </button>
                            <button 
                              onClick={() => setWinners({...winners, [match.id]: 'push'})}
                              className={`py-4 rounded-xl text-sm font-black border-2 transition-all ${winners[match.id] === 'push' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white border-gray-200 text-slate-800 hover:border-amber-500/50'}`}
                            >
                              ยกเลิก/เสมอ
                            </button>
                            <button 
                              onClick={() => setWinners({...winners, [match.id]: 'away'})}
                              className={`py-4 rounded-xl text-sm font-black border-2 transition-all ${winners[match.id] === 'away' ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-white border-gray-200 text-slate-800 hover:border-blue-500/50'}`}
                            >
                              ทีม 2 ชนะ
                            </button>
                          </div>
                        </div>

                        {!calcStagedIds.includes(match.id) && (
                          <button 
                            onClick={() => {
                              const h = (document.getElementById(`home-${match.id}`) as HTMLInputElement).value;
                              const a = (document.getElementById(`away-${match.id}`) as HTMLInputElement).value;
                              const manualWinner = winners[match.id];
                              
                              if (!h || !a) {
                                alert('กรุณาใส่ผลสกอร์');
                                return;
                              }
                              if (!manualWinner) {
                                alert('กรุณาเลือกฝั่งที่ชนะในราคาต่อรอง');
                                return;
                              }
                              
                              setScores(match.id, Number(h), Number(a), manualWinner);
                            }}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl text-huge font-black flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all active:scale-[0.98]"
                          >
                            {calcLoading === match.id ? (
                              <Loader2 className="w-6 h-6 animate-spin text-world-cup-green" />
                            ) : (
                              <>
                                <CheckCircle className="w-6 h-6 text-world-cup-green" />
                                คำนวณและสรุปคะแนน
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-4">
                        <div className="flex justify-between items-center bg-gray-50 p-6 rounded-2xl border border-gray-200 shadow-inner">
                          <div className="text-center">
                            <p className="text-[10px] text-black font-black uppercase tracking-widest">{match.homeTeam}</p>
                            <p className="text-giant font-black text-black">{match.homeScore}</p>
                          </div>
                          <div className="text-giant font-black text-black">-</div>
                          <div className="text-center">
                            <p className="text-[10px] text-black font-black uppercase tracking-widest">{match.awayTeam}</p>
                            <p className="text-giant font-black text-black">{match.awayScore}</p>
                          </div>
                        </div>
                        <div className="flex justify-between items-center border-t border-gray-100 pt-3">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 italic">
                             <span className="text-black font-black">ฝั่งชนะ:</span>
                             <span className="text-world-cup-green uppercase tracking-tighter font-black">
                               {match.manualWinner === 'home' && `ทีม 1 (${match.homeTeam})`}
                               {match.manualWinner === 'away' && `ทีม 2 (${match.awayTeam})`}
                               {match.manualWinner === 'push' && 'ยกเลิก/เสมอ'}
                             </span>
                             <Check className="w-3.5 h-3.5 text-green-500" />
                          </div>
                          <button
                            onClick={async () => {
                              if (window.confirm(`ต้องการคำนวณคะแนนใหม่สำหรับคู่ ${match.homeTeam} vs ${match.awayTeam} หรือไม่? (จะปรับแต้มของผู้เล่นทุกคนรวมถึงผู้ที่ไม่ได้ทายผลตามกติกาใหม่ทันที)`)) {
                                setCalcLoading(match.id);
                                try {
                                  await calculateMatchResults(match.id);
                                  alert('คำนวณและอัปเดตคะแนนใหม่เรียบร้อยแล้ว!');
                                } catch (err: any) {
                                  console.error(err);
                                  alert('เกิดข้อผิดพลาดในการคำนวณใหม่: ' + err.message);
                                } finally {
                                  setCalcLoading(null);
                                }
                              }
                            }}
                            disabled={calcLoading === match.id}
                            className="flex items-center gap-1.5 bg-slate-900 hover:bg-black text-white text-[10px] font-black uppercase px-3 py-2 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                          >
                            {calcLoading === match.id ? (
                              <Loader2 className="w-3 h-3 animate-spin text-world-cup-gold" />
                            ) : (
                              <RefreshCw className="w-3 h-3 text-world-cup-gold" />
                            )}
                            คำนวณคะแนนใหม่
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  ))}
                </div>

                {/* 2. Desktop Table View */}
                <div className="hidden lg:block overflow-x-auto bg-[#0f172a]/95 backdrop-blur-2xl rounded-[2.3rem] border border-slate-800/80 shadow-2xl p-6 text-slate-100">
                  <table className="w-full border-collapse text-left">
                    <thead>
                      <tr className="border-b border-slate-800 text-[11px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="pb-3 pl-2 w-14 text-center">เลือก</th>
                        <th className="pb-3 w-24 text-center">เวลา / รอบ</th>
                        <th className="pb-3 text-right pr-6 w-[28%]">ทีมเหย้า</th>
                        <th className="pb-3 text-center w-40">ผลสกอร์ (HT)</th>
                        <th className="pb-3 text-left pl-6 w-[28%]">ทีมเยือน</th>
                        <th className="pb-3 text-center w-28">ราคาบอล</th>
                        <th className="pb-3 text-center w-32">สิทธิ์ทายผล</th>
                        <th className="pb-3 text-right pr-2 w-36">การจัดการ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {matches.filter(match => {
                        if (deferredAdminTab === 'history') {
                          return match.status === MatchStatus.FINISHED;
                        }
                        return match.status !== MatchStatus.FINISHED;
                      }).map(match => {
                        const formattedTime = formatInThailandTime(match.startTime, 'HH:mm');
                        const formattedDate = formatInThailandTime(match.startTime, 'dd/MM');
                        const isFinished = match.status === MatchStatus.FINISHED;

                        return (
                          <tr key={match.id} className={`border-b border-slate-800/40 hover:bg-slate-800/30 transition-colors ${calcStagedIds.includes(match.id) ? 'bg-world-cup-gold/5' : ''}`}>
                            {/* Checkbox (select for batch calc) */}
                            <td className="py-4 pl-2 text-center align-middle">
                              {!isFinished && (
                                <button 
                                  onClick={() => toggleCalcStage(match.id)}
                                  className={`w-5 h-5 rounded border flex items-center justify-center transition-all cursor-pointer mx-auto ${calcStagedIds.includes(match.id) ? 'bg-world-cup-gold border-world-cup-gold text-slate-950' : 'border-slate-700 bg-slate-900/50'}`}
                                >
                                  {calcStagedIds.includes(match.id) && <Check className="w-3.5 h-3.5 font-bold" />}
                                </button>
                              )}
                            </td>

                            {/* Time / Round */}
                            <td className="py-4 text-center align-middle">
                              <div className="flex flex-col items-center justify-center">
                                {isFinished ? (
                                  <span className="text-[10px] font-black text-rose-500 uppercase bg-rose-500/10 px-1.5 py-0.5 rounded">จบ</span>
                                ) : (
                                  <>
                                    <span className="text-[10px] text-slate-400 font-bold">{formattedDate}</span>
                                    <span className="text-xs font-black text-white">{formattedTime}</span>
                                  </>
                                )}
                                <span className="text-[8px] font-bold text-slate-500 mt-0.5 uppercase tracking-tighter">
                                  {match.round === TournamentRound.GROUP && 'แบ่งกลุ่ม'}
                                  {match.round === TournamentRound.TOP32 && 'รอบ 32'}
                                  {match.round === TournamentRound.TOP16 && 'รอบ 16'}
                                  {match.round === TournamentRound.TOP8 && 'รอบ 8'}
                                  {match.round === TournamentRound.TOP4 && 'รอบรอง'}
                                  {match.round === TournamentRound.THIRD_PLACE && 'ชิงที่ 3'}
                                  {match.round === TournamentRound.FINAL && 'ชิงชนะเลิศ'}
                                </span>
                              </div>
                            </td>

                            {/* Home Team */}
                            <td className="py-4 text-right pr-6 align-middle">
                              <div className="flex items-center justify-end gap-3.5">
                                <span className="text-sm font-black text-white tracking-tight">{match.homeTeam}</span>
                                <img src={match.homeFlag} alt={match.homeTeam} className="w-7 h-5 object-cover rounded shadow-md border border-slate-700" />
                              </div>
                            </td>

                            {/* Score / Scoring inputs */}
                            <td className="py-4 text-center align-middle">
                              {isFinished ? (
                                <div className="flex flex-col items-center justify-center gap-1">
                                  <span className="text-base font-black text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-xl">
                                    {match.homeScore} - {match.awayScore}
                                  </span>
                                  <button
                                    onClick={async () => {
                                      if (window.confirm(`ต้องการคำนวณคะแนนใหม่สำหรับคู่ ${match.homeTeam} vs ${match.awayTeam} หรือไม่?`)) {
                                        setCalcLoading(match.id);
                                        try {
                                          await calculateMatchResults(match.id);
                                          alert('คำนวณและอัปเดตคะแนนใหม่เรียบร้อยแล้ว!');
                                        } catch (err: any) {
                                          console.error(err);
                                          alert('เกิดข้อผิดพลาดในการคำนวณใหม่: ' + err.message);
                                        } finally {
                                          setCalcLoading(null);
                                        }
                                      }
                                    }}
                                    disabled={calcLoading === match.id}
                                    className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-350 hover:text-white text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                                  >
                                    {calcLoading === match.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-world-cup-gold" />
                                    ) : (
                                      <RefreshCw className="w-3 h-3 text-world-cup-gold" />
                                    )}
                                    <span>คำนวณใหม่</span>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex flex-col items-center gap-2 justify-center">
                                  <div className="flex items-center gap-1.5 justify-center">
                                    <input 
                                      id={`desktop-home-${match.id}`} 
                                      type="number" 
                                      placeholder="-" 
                                      className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center text-sm font-black text-white focus:border-world-cup-green focus:outline-none" 
                                    />
                                    <span className="text-slate-500 font-black px-0.5">:</span>
                                    <input 
                                      id={`desktop-away-${match.id}`} 
                                      type="number" 
                                      placeholder="-" 
                                      className="w-10 h-10 bg-slate-900 border border-slate-700 rounded-lg text-center text-sm font-black text-white focus:border-world-cup-green focus:outline-none" 
                                    />
                                  </div>
                                  
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <select 
                                      id={`desktop-winner-${match.id}`}
                                      onChange={(e) => {
                                        setWinners(prev => ({ ...prev, [match.id]: e.target.value as any }));
                                      }}
                                      value={winners[match.id] || ''}
                                      className="bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 rounded-lg px-2.5 py-1 focus:outline-none"
                                    >
                                      <option value="">ฝั่งชนะ</option>
                                      <option value="home">ทีม 1</option>
                                      <option value="away">ทีม 2</option>
                                      <option value="push">เสมอ</option>
                                    </select>
                                    
                                    <button
                                      onClick={async () => {
                                        const hInput = document.getElementById(`desktop-home-${match.id}`) as HTMLInputElement;
                                        const aInput = document.getElementById(`desktop-away-${match.id}`) as HTMLInputElement;
                                        const h = hInput?.value;
                                        const a = aInput?.value;
                                        const winner = winners[match.id];
                                        
                                        if (!h || !a || !winner) {
                                          alert('กรุณากรอกสกอร์และเลือกทีมที่ชนะราคาต่อรองให้ครบถ้วน');
                                          return;
                                        }
                                        
                                        if (window.confirm(`ยืนยันบันทึกผลการแข่งขัน ${match.homeTeam} vs ${match.awayTeam}?`)) {
                                          await setScores(match.id, Number(h), Number(a), winner);
                                        }
                                      }}
                                      disabled={calcLoading === match.id}
                                      className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs px-2.5 py-1 rounded-lg cursor-pointer transition-colors disabled:opacity-50"
                                    >
                                      บันทึก
                                    </button>
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* Away Team */}
                            <td className="py-4 text-left pl-6 align-middle">
                              <div className="flex items-center justify-start gap-3.5">
                                <img src={match.awayFlag} alt={match.awayTeam} className="w-7 h-5 object-cover rounded shadow-md border border-slate-700" />
                                <span className="text-sm font-black text-white tracking-tight">{match.awayTeam}</span>
                              </div>
                            </td>

                            {/* Handicap Price */}
                            <td className="py-4 text-center align-middle">
                              <div className="flex flex-col items-center justify-center gap-0.5">
                                <span className="text-emerald-400 text-xs font-black bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                                  {match.handicap || '0.0'}
                                </span>
                                {match.customWinScore !== undefined && match.customWinScore !== null && (
                                  <span className="text-[7px] font-bold text-rose-400 border border-rose-500/20 px-1 rounded bg-rose-500/5 scale-90">
                                    คู่เอก (+{match.customWinScore}/{match.customLossScore})
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Prediction Status Allow Switch */}
                            <td className="py-4 text-center align-middle">
                              {!isFinished ? (
                                <button
                                  onClick={async () => {
                                    await updateDoc(doc(db, 'matches', match.id), {
                                      allowPredictions: !match.allowPredictions
                                    });
                                  }}
                                  className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border cursor-pointer select-none flex items-center gap-1 justify-center mx-auto shadow-sm ${
                                    match.allowPredictions 
                                      ? 'bg-emerald-500 text-white border-emerald-400 hover:bg-emerald-600 shadow-emerald-500/20' 
                                      : 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600 shadow-rose-500/20'
                                  }`}
                                >
                                  {match.allowPredictions ? (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                                      <span>เปิดทายแล้ว</span>
                                    </>
                                  ) : (
                                    <>
                                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                      <span>ปิดรับทาย</span>
                                    </>
                                  )}
                                </button>
                              ) : (
                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">หมดเวลาทาย</span>
                              )}
                            </td>

                            {/* Actions / Management */}
                            <td className="py-4 text-right pr-2 align-middle">
                              <div className="flex items-center justify-end gap-1">
                                <button 
                                  onClick={async () => {
                                    await updateDoc(doc(db, 'matches', match.id), {
                                      isPublished: !match.isPublished
                                    });
                                  }}
                                  className={`p-1.5 rounded-md transition-all cursor-pointer ${match.isPublished ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                                  title={match.isPublished ? "ซ่อนแมตช์" : "แสดงแมตช์"}
                                >
                                  <CheckCircle className={`w-3.5 h-3.5 ${match.isPublished ? 'fill-current text-green-400' : ''}`} />
                                </button>
                                
                                <button 
                                  onClick={() => handleEditMatch(match)}
                                  className="p-1.5 rounded-md bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all cursor-pointer shadow-sm"
                                  title="แก้ไขแมตช์"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                
                                <button 
                                  onClick={async () => {
                                    const isSpecial = match.customWinScore !== undefined && match.customWinScore !== null;
                                    if (isSpecial) {
                                      await updateDoc(doc(db, 'matches', match.id), {
                                        customWinScore: null,
                                        customLossScore: null
                                      });
                                    } else {
                                      await updateDoc(doc(db, 'matches', match.id), {
                                        customWinScore: 5,
                                        customLossScore: -3
                                      });
                                    }
                                  }}
                                  className={`p-1.5 rounded-md transition-all cursor-pointer ${match.customWinScore !== undefined && match.customWinScore !== null ? 'bg-yellow-500 text-slate-950 hover:bg-yellow-400' : 'bg-slate-800 text-yellow-400/70 hover:bg-slate-700'}`}
                                  title="คู่เอก (ไฮไลท์)"
                                >
                                  <Star className={`w-3.5 h-3.5 ${match.customWinScore !== undefined && match.customWinScore !== null ? 'fill-current' : ''}`} />
                                </button>
                                
                                <button 
                                  onClick={() => deleteMatch(match.id)} 
                                  className="p-1.5 rounded-md text-red-400 bg-red-500/10 hover:bg-red-500 hover:text-white transition-all cursor-pointer shadow-sm"
                                  title="ลบแมตช์"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )
          }
          </div>
        )}
    </>
  )}
      {showStatusModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 z-50 overflow-y-auto">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-[#0f172a] border border-slate-800 rounded-[2.5rem] p-6 max-w-4xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)] text-slate-100"
          >
            <div className="flex justify-between items-center border-b border-slate-850 pb-4">
              <div className="flex items-center gap-3">
                <ClipboardList className="w-6 h-6 text-emerald-400" />
                <h3 className="text-xl font-black uppercase tracking-wider text-white">ตรวจสอบสถานะการทายผล</h3>
              </div>
              <button 
                onClick={() => setShowStatusModal(false)}
                className="w-10 h-10 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-all text-xl"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {matches.filter(m => m.status === 'scheduled').length === 0 ? (
                <p className="text-center text-slate-400 py-8 font-black uppercase">ไม่มีแมตช์ที่กำลังรอแข่ง</p>
              ) : (
                matches.filter(m => m.status === 'scheduled').map(m => {
                  const matchPreds = allPredictions.filter(p => p.matchId === m.id);
                  const playersOnly = users.filter(u => u.role !== 'admin');
                  
                  const predictedUsers: { name: string, choice: string }[] = [];
                  const missingUsers: string[] = [];
                  const bannedUsers: string[] = [];

                  playersOnly.forEach(u => {
                    const isBanned = u.bannedMatchIds?.includes(m.id);
                    const p = matchPreds.find(pred => pred.userId === u.uid);

                    if (isBanned) {
                      bannedUsers.push(u.displayName);
                    } else if (p && p.choice !== null && p.choice !== undefined) {
                      const choiceName = p.choice === 'home' ? m.homeTeam : m.awayTeam;
                      predictedUsers.push({ name: u.displayName, choice: choiceName });
                    } else {
                      missingUsers.push(u.displayName);
                    }
                  });

                  const deadlineDate = m.predictionDeadline ? (m.predictionDeadline.toDate ? m.predictionDeadline.toDate() : new Date(m.predictionDeadline.seconds * 1000)) : null;
                  const deadlineStr = deadlineDate ? deadlineDate.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' }) : '-';

                  return (
                    <div key={m.id} className="bg-slate-900/60 border border-slate-800 rounded-3xl p-5 space-y-4">
                      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-800/60 pb-3">
                        <div>
                          <h4 className="text-lg font-black text-white">{m.homeTeam} vs {m.awayTeam}</h4>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">⏱️ Deadline: {deadlineStr}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider ${missingUsers.length === 0 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            ทายแล้ว {predictedUsers.length} / {playersOnly.length} คน
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-black uppercase">
                        {/* Predicted List */}
                        <div className="bg-emerald-950/20 border border-emerald-900/20 p-4 rounded-2xl space-y-2.5">
                          <h5 className="text-emerald-450 flex items-center gap-1.5 font-black">
                            🟢 ทายแล้ว ({predictedUsers.length})
                          </h5>
                          <ul className="space-y-1.5 font-bold normal-case text-slate-300">
                            {predictedUsers.length === 0 ? <li className="text-slate-500 italic">ไม่มี</li> : predictedUsers.map((pu, idx) => (
                              <li key={idx} className="flex justify-between items-center bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-900/50">
                                <span className="font-semibold text-slate-200">{pu.name}</span>
                                <span className="text-[10px] font-black text-emerald-400 uppercase tracking-wider bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">{pu.choice}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Missing List */}
                        <div className="bg-rose-950/20 border border-rose-900/20 p-4 rounded-2xl space-y-2.5">
                          <h5 className="text-rose-450 flex items-center gap-1.5 font-black">
                            🔴 ยังไม่ได้ทาย ({missingUsers.length})
                          </h5>
                          <ul className="space-y-1.5 font-bold normal-case text-slate-350">
                            {missingUsers.length === 0 ? <li className="text-emerald-400 font-bold italic">🎉 ครบทุกคนแล้ว!</li> : missingUsers.map((name, idx) => (
                              <li key={idx} className="bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-900/50 text-slate-200">
                                {name}
                              </li>
                            ))}
                          </ul>
                        </div>

                        {/* Banned List */}
                        <div className="bg-amber-950/20 border border-amber-900/20 p-4 rounded-2xl space-y-2.5">
                          <h5 className="text-amber-500 flex items-center gap-1.5 font-black">
                            🟥 โดนแบน ({bannedUsers.length})
                          </h5>
                          <ul className="space-y-1.5 font-bold normal-case text-slate-350">
                            {bannedUsers.length === 0 ? <li className="text-slate-500 italic">ไม่มี</li> : bannedUsers.map((name, idx) => (
                              <li key={idx} className="bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-900/50 text-slate-400 line-through">
                                {name}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="border-t border-slate-800 pt-4 flex justify-end">
              <button 
                onClick={() => setShowStatusModal(false)}
                className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all"
              >
                ปิดหน้าต่าง
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
