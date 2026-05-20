import React, { useState, useEffect, useDeferredValue } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, Timestamp, deleteDoc, writeBatch, getDoc, getDocs, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TournamentRound, Match, MatchStatus, User } from '../types';
import { useAuth, PLAYER_PINS } from '../contexts/AuthContext';
import { calculateMatchResults } from '../lib/gameLogic';
import { Trash2, Edit3, CheckCircle, PlusCircle, RefreshCw, Calendar, ChevronDown, Check, Camera, Loader2, Info, Zap, Star, FileUp } from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { WORLD_CUP_2026_SCHEDULE, MockMatch } from '../data/worldCupSchedule';
import * as XLSX from 'xlsx';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'matches' | 'players' | 'custom'>('matches');
  const deferredAdminTab = useDeferredValue(activeAdminTab);
  const [showAdd, setShowAdd] = useState(false);
  
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

    return () => {
      unsubMatches();
      unsubUsers();
      unsubConfig();
    };
  }, []);

  const handleBulkImportText = async () => {
    if (!bulkText.trim()) return;

    const lines = bulkText.split('\n').filter(l => l.trim().length > 0);
    const processedLines = lines.map(line => {
      let cols: string[] = [];
      if (line.includes('|')) cols = line.split('|').map(s => s.trim());
      else if (line.includes('\t')) cols = line.split('\t').map(s => s.trim());
      
      // Handle the user's specific 3-column format: [DateStr, Team1, Team2]
      if (cols.length === 3) {
        const [rawDate, team1, team2] = cols;
        // Clean date: "Thursday, June 11, at 3:00 PM" -> "June 11, 2026 3:00 PM"
        let cleanDateStr = rawDate.replace(/^[A-Za-z]+,\s+/, '').replace(/at\s+/g, '');
        if (!cleanDateStr.includes('2026')) {
           // If it's something like "June 11", we add ", 2026"
           if (cleanDateStr.includes(',')) {
             cleanDateStr = cleanDateStr.replace(',', ', 2026,');
           } else {
             // Split by space to insert year after month and day
             const parts = cleanDateStr.split(' ');
             if (parts.length >= 2) {
                // June 11 3:00 PM -> June 11, 2026 3:00 PM
                cleanDateStr = `${parts[0]} ${parts[1]}, 2026 ${parts.slice(2).join(' ')}`;
             }
           }
        }
        return [team1, team2, "0.0", cleanDateStr];
      }
      
      if (cols.length >= 4) return cols;
      return null;
    }).filter(l => l !== null);

    if (processedLines.length === 0) {
      alert('ไม่พบข้อมูลที่ถูกต้อง (รูปแบบ: ทีมเหย้า | ทีมเยือน | ราคา | เวลา หรือ ตารางจาก Excel)');
      return;
    }

    if (window.confirm(`ตรวจพบ ${processedLines.length} คู่ ต้องการเพิ่มทั้งหมดหรือไม่?`)) {
      setBatchLoading(true);
      try {
        const batch = writeBatch(db);
        const seenIds = new Set<string>();
        let addedCount = 0;

        processedLines.forEach((cols) => {
          const [h, a, hc, st] = cols as string[];
          if (h && a && hc && st) {
            const startDate = new Date(st);
            if (isNaN(startDate.getTime())) return;
            
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
              predictionDeadline: Timestamp.fromDate(new Date(startDate.getTime() - 3600000)),
              round: TournamentRound.GROUP,
              homeFlag: `https://flagcdn.com/w80/${getCountryCode(h)}.png`,
              awayFlag: `https://flagcdn.com/w80/${getCountryCode(a)}.png`,
              status: MatchStatus.SCHEDULED,
              isPublished: false
            });
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
                startDate = cell;
                dateIndex = i;
                break;
              }
              if (typeof cell === 'number') {
                // If it is serial format like 45000+
                if (cell > 40000 && cell < 60000) {
                  startDate = parseExcelSerialDate(cell);
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
                const d = new Date(cleanStr);
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
            const batch = writeBatch(db);
            const seenIds = new Set<string>();
            let addedCount = 0;

            validRows.forEach((row) => {
              const startMs = row.startDate.getTime();
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
                startTime: Timestamp.fromDate(row.startDate),
                predictionDeadline: Timestamp.fromDate(new Date(row.startDate.getTime() - 3600000)),
                round: TournamentRound.GROUP,
                homeFlag: `https://flagcdn.com/w80/${getCountryCode(row.h)}.png`,
                awayFlag: `https://flagcdn.com/w80/${getCountryCode(row.a)}.png`,
                status: MatchStatus.SCHEDULED,
                isPublished: false
              });
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
      const date = new Date(startTime);
      const deadlineDate = predictionDeadline ? new Date(predictionDeadline) : date;
      
      if (editingMatchId) {
        await updateDoc(doc(db, 'matches', editingMatchId), {
          homeTeam,
          awayTeam,
          homeFlag: `https://flagcdn.com/w80/${getCountryCode(homeTeam)}.png`, 
          awayFlag: `https://flagcdn.com/w80/${getCountryCode(awayTeam)}.png`,
          handicap: handicap,
          round: round,
          startTime: Timestamp.fromDate(date),
          predictionDeadline: Timestamp.fromDate(deadlineDate),
          customWinScore: isSpecialMatch ? Number(customWinScore) : null,
          customLossScore: isSpecialMatch ? Number(customLossScore) : null,
          isPublished: true // Auto publish on save edit
        });
        setEditingMatchId(null);
      } else {
        await addDoc(collection(db, 'matches'), {
          homeTeam,
          awayTeam,
          homeFlag: `https://flagcdn.com/w80/${getCountryCode(homeTeam)}.png`, 
          awayFlag: `https://flagcdn.com/w80/${getCountryCode(awayTeam)}.png`,
          handicap: handicap,
          round: round,
          startTime: Timestamp.fromDate(date),
          predictionDeadline: Timestamp.fromDate(deadlineDate),
          status: MatchStatus.SCHEDULED,
          customWinScore: isSpecialMatch ? Number(customWinScore) : null,
          customLossScore: isSpecialMatch ? Number(customLossScore) : null,
          isPublished: true // Auto publish on manual add
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

  const handleEditMatch = (match: Match) => {
    setEditingMatchId(match.id);
    setHomeTeam(match.homeTeam);
    setAwayTeam(match.awayTeam);
    setHandicap(match.handicap);
    setRound(match.round);
    setStartTime(format(new Date(match.startTime.seconds * 1000), "yyyy-MM-dd'T'HH:mm"));
    setPredictionDeadline(format(new Date(match.predictionDeadline.seconds * 1000), "yyyy-MM-dd'T'HH:mm"));
    
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
      'Uzbekistan': 'uz', 'Colombia': 'co', 'Iraq': 'iq', 'Italy': 'it'
    };
    
    const teamLower = team.toUpperCase();
    if (teamLower.includes('UEFA') || teamLower.includes('FIFA')) return 'un';
    
    return codes[team] || team.substring(0, 2).toLowerCase();
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center text-world-cup-green">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl italic font-black uppercase tracking-tighter">ADMIN PANEL</h2>
          </div>
          <div className="bg-gray-100 p-1 rounded-xl flex shadow-sm">
            <button 
              onClick={() => setActiveAdminTab('matches')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeAdminTab === 'matches' ? 'bg-world-cup-green text-white shadow-md' : 'text-gray-400'}`}
            >
              แมตช์
            </button>
            <button 
              onClick={() => setActiveAdminTab('players')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeAdminTab === 'players' ? 'bg-world-cup-green text-white shadow-md' : 'text-gray-400'}`}
            >
              ผู้เล่น
            </button>
            <button 
              onClick={() => setActiveAdminTab('custom')}
              className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${activeAdminTab === 'custom' ? 'bg-world-cup-green text-white shadow-md' : 'text-gray-400'}`}
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
      )}

      {deferredAdminTab === 'players' && (
        <div className="space-y-6">
          <div className="wc-glass p-6 rounded-3xl border-t-2 border-world-cup-green/20">
            <h3 className="text-sm text-gray-400 italic uppercase tracking-wider mb-2 text-center underline underline-offset-4">สรุปรายชื่อเพื่อนซี้</h3>
            <p className="text-[10px] text-center text-gray-500 mb-6 font-semibold">ผู้เล่นสมัครสมาชิกเองผ่านหน้าลงทะเบียน</p>
            
            <div className="space-y-3">
              {users.map((u, idx) => (
                <div key={u.uid} className="wc-glass p-5 rounded-2xl flex items-center justify-between border border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-world-cup-green/10 flex items-center justify-center text-sm text-world-cup-green font-bold border border-world-cup-green/20">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-huge text-slate-800 font-bold">{u.displayName}</p>
                        {u.personalPin && (
                          <span className="text-[10px] bg-amber-50 text-world-cup-gold border border-amber-200 px-2 py-0.5 rounded-lg font-black tracking-widest flex items-center gap-1 select-all">
                            🔑 {u.personalPin}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 font-medium">{u.role === 'admin' ? 'แอดมิน' : 'ผู้เล่น'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-huge text-world-cup-gold font-black">{u.points}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">POINTS</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="wc-glass p-6 rounded-3xl border-t-2 border-world-cup-gold/20">
            <div className="flex items-center gap-2 justify-center mb-1">
              <Zap className="w-4 h-4 text-world-cup-gold animate-bounce" />
              <h3 className="text-sm font-black text-slate-800 italic uppercase tracking-wider">สถานะการใช้งานรหัสผ่าน (PIN Status Explorer)</h3>
            </div>
            <p className="text-[10px] text-center text-gray-500 mb-6">เฉพาะแอดมินเท่านั้นที่จะมองเห็นส่วนนี้ เพื่อใช้สุ่มรหัสผ่านแจกจ่ายให้เพื่อนๆ</p>

            <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 gap-3">
              {PLAYER_PINS.map((playerPin) => {
                const occupier = users.find(u => u.personalPin === playerPin);
                const isOccupied = !!occupier;

                return (
                  <div
                    key={playerPin}
                    className={`p-3.5 rounded-2xl border flex flex-col justify-center items-center gap-1.5 transition-all text-center ${
                      isOccupied 
                        ? 'bg-slate-50 border-slate-100 text-slate-400' 
                        : 'bg-white border-slate-200 hover:border-world-cup-green/40 shadow-sm'
                    }`}
                  >
                    <span className={`text-sm font-black tracking-widest ${isOccupied ? 'line-through text-slate-300' : 'text-world-cup-gold text-base'}`}>
                      {playerPin}
                    </span>
                    <span className="text-[10px] font-bold block max-w-full truncate">
                      {isOccupied ? (
                        <span className="text-red-500 font-semibold">🔒 {occupier.displayName}</span>
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
              <h3 className="text-xl italic font-black uppercase tracking-widest text-slate-800">APP CUSTOMIZATION</h3>
              <p className="text-xs text-gray-400 font-bold uppercase tracking-tighter">ปรับโฉมสนามในพริบตา</p>
            </div>

            <div className="grid grid-cols-1 gap-8">
              {/* Logo Customization */}
              <div className="space-y-4">
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block text-center">โลโก้แอป (Logo)</label>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-24 h-24 bg-gray-50 border-4 border-dashed border-gray-200 rounded-3xl flex items-center justify-center overflow-hidden">
                    {appConfig?.logoUrl ? (
                      <img src={appConfig.logoUrl} className="w-full h-full object-contain" />
                    ) : (
                      <PlusCircle className="w-10 h-10 text-gray-200" />
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
                <label className="text-xs font-black text-gray-400 uppercase tracking-widest block text-center">พื้นหลังแอป (Background)</label>
                <div className="flex flex-col items-center gap-4">
                  <div className="w-full aspect-video bg-gray-50 border-4 border-dashed border-gray-200 rounded-3xl flex items-center justify-center overflow-hidden relative">
                    {appConfig?.backgroundUrl ? (
                      <img src={appConfig.backgroundUrl} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-gray-300 text-center font-bold italic">
                        <Camera className="w-12 h-12 mx-auto mb-2 opacity-20" />
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
                className="w-full py-4 text-xs font-bold text-gray-400 uppercase tracking-widest hover:text-red-500 transition-all border border-gray-100 rounded-2xl"
              >
                คืนค่าเริ่มต้นทั้งหมด
              </button>
            </div>
          </div>
        </div>
      )}

      {deferredAdminTab === 'matches' && (
        <>
          {showAdd && (
            <div className="space-y-4">
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
              <div className="wc-glass p-4 rounded-2xl flex flex-col gap-3">
                <button 
                  type="button"
                  onClick={() => setShowMockList(!showMockList)}
                  className="flex items-center justify-between w-full bg-gray-50 p-4 rounded-xl border border-gray-100 text-sm text-world-cup-gold shadow-sm hover:bg-gray-100 transition-all font-bold"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {showMockList ? 'ปิดรายการแมตช์แนะนำ' : 'เลือกจากรายการแมตช์แนะนำ (World Cup 2026)'}
                  </div>
                  <ChevronDown className={`w-5 h-5 transition-transform ${showMockList ? 'rotate-180' : ''}`} />
                </button>

                {showMockList && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto no-scrollbar pt-2">
                      {WORLD_CUP_2026_SCHEDULE.map((m, idx) => {
                        const isSelected = stagedMatches.some(sm => sm.homeTeam === m.homeTeam && sm.awayTeam === m.awayTeam && sm.startTime === m.startTime);
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => toggleMockMatch(m)}
                            className={`flex items-center justify-between p-4 rounded-xl border transition-all text-left shadow-sm ${
                              isSelected 
                                ? 'border-world-cup-green bg-world-cup-green/10' 
                                : 'bg-white border-gray-100 hover:border-world-cup-green/50 hover:bg-world-cup-green/5'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex -space-x-2">
                                <img src={m.homeFlag} className="w-8 h-5 rounded-sm border border-gray-200" />
                                <img src={m.awayFlag} className="w-8 h-5 rounded-sm border border-gray-200" />
                              </div>
                              <span className="text-sm font-bold text-slate-700">{m.homeTeam} vs {m.awayTeam}</span>
                              {isSelected && <Check className="w-4 h-4 text-world-cup-green" />}
                            </div>
                            <span className="text-xs text-gray-400 font-medium">{format(new Date(m.startTime), 'dd/MM/yyyy HH:mm')}</span>
                          </button>
                        );
                      })}
                    </div>

                    {stagedMatches.length > 0 && (
                      <div className="space-y-4 pt-4 border-t border-gray-100">
                        <div className="bg-world-cup-gold/10 p-5 rounded-[2rem] border border-world-cup-gold/20 space-y-3">
                          <label className="text-[10px] font-black text-world-cup-gold uppercase tracking-[0.2em] block text-center">
                            ตั้งเวลา "ปิดทายผล" ครั้งเดียว (สำหรับแมตช์ที่เลือกทั้งหมด)
                          </label>
                          <input 
                            type="datetime-local" 
                            required 
                            value={batchDeadline} 
                            onChange={e => setBatchDeadline(e.target.value)} 
                            className="w-full bg-white border border-world-cup-gold/30 rounded-xl p-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-world-cup-gold/20 text-center"
                          />
                        </div>

                        <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-center">แมตช์ที่เลือก ({stagedMatches.length})</h4>
                        <div className="space-y-3">
                          {stagedMatches.map((m, idx) => (
                            <div key={idx} className="bg-white p-4 rounded-2xl border border-gray-100 space-y-3 shadow-inner">
                              <div className="flex justify-between items-center">
                                <span className="text-sm font-black text-slate-800">{m.homeTeam} vs {m.awayTeam}</span>
                                <button type="button" onClick={() => toggleMockMatch(m)} className="text-red-400 p-1"><Trash2 className="w-4 h-4" /></button>
                              </div>
                              <div className="grid grid-cols-1 gap-3">
                                <div>
                                  <label className="text-[9px] font-bold text-gray-400 uppercase tracking-widest block mb-1">Handicap</label>
                                  <input 
                                    type="text" 
                                    value={m.stagedHandicap} 
                                    onChange={(e) => {
                                      const newStaged = [...stagedMatches];
                                      newStaged[idx].stagedHandicap = e.target.value;
                                      setStagedMatches(newStaged);
                                    }}
                                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-2 text-xs font-bold focus:outline-none focus:border-world-cup-green text-center"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <button 
                          type="button"
                          onClick={handleBatchAdd}
                          className="w-full bg-world-cup-gold text-white py-4 rounded-2xl font-black uppercase text-sm shadow-lg shadow-world-cup-gold/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
                        >
                          บันทึกแมตช์ที่เลือกทั้งหมด ({stagedMatches.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddMatch} className="wc-glass p-8 rounded-3xl space-y-6 border-t-4 border-world-cup-gold">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-4">นำเข้าจาก Excel / Google Sheets</label>
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
                      className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-xs font-bold focus:border-world-cup-green focus:outline-none min-h-[120px]"
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

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">ทีม 1 (Team 1)</label>
                    <input required value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" placeholder="เช่น Argentina" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">ทีม 2 (Team 2)</label>
                    <input required value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" placeholder="เช่น France" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">ราคาต่อรอง (Handicap)</label>
                    <input type="text" required value={handicap} onChange={e => setHandicap(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all font-bold text-world-cup-green" placeholder="เช่น 0.5 หรือ 0.5/1" title="เป็นราคาต่อรองของฝั่งเจ้าบ้าน" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">รอบการแข่งขัน</label>
                    <select value={round} onChange={e => setRound(e.target.value as TournamentRound)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all">
                      <option value={TournamentRound.GROUP}>รอบแบ่งกลุ่ม</option>
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
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest">เวลาแข่งขัน (Start Time)</label>
                    <input type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge focus:outline-none focus:ring-2 focus:ring-world-cup-green/20 focus:border-world-cup-green transition-all" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs text-gray-500 font-bold uppercase tracking-widest text-world-cup-gold">ปิดทายผล (Deadline)</label>
                    <input type="datetime-local" required value={predictionDeadline} onChange={e => setPredictionDeadline(e.target.value)} className="w-full bg-white border border-gray-200 rounded-xl p-4 text-huge focus:outline-none focus:ring-2 focus:ring-world-cup-gold/20 focus:border-world-cup-gold transition-all" />
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
                    <span className="text-sm font-black text-slate-700 uppercase tracking-widest">เปิดระบบคะแนนพิเศษ (คู่เอก)</span>
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
                          className="w-full bg-white border-2 border-red-500/20 rounded-xl p-4 text-huge font-black focus:border-red-500 focus:outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">คะแนนทายผิด (-)</label>
                        <input 
                          type="number" 
                          value={customLossScore} 
                          onChange={e => setCustomLossScore(e.target.value)} 
                          placeholder="เช่น -5" 
                          className="w-full bg-white border-2 border-slate-200 rounded-xl p-4 text-huge font-black focus:border-slate-500 focus:outline-none transition-all"
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
              </form>
            </div>
          )}

        {!showAdd && (
          <div className="space-y-6">
            {calcStagedIds.length > 0 && (
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
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">BATCH CALCULATION</h3>
                      <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight">เลือกแล้ว {calcStagedIds.length} คู่</p>
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

            {matches.map(match => (
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
                      <h3 className="text-xl font-black text-slate-800">{match.homeTeam} vs {match.awayTeam}</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">{format(new Date(match.startTime.seconds * 1000), 'dd/MM/yyyy HH:mm')}</span>
                        <div className="flex items-center gap-1 bg-world-cup-green/10 px-2 py-0.5 rounded border border-world-cup-green/20">
                          <span className="text-[8px] font-black text-gray-400 uppercase tracking-tighter">ราคา:</span>
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
                    <div className="flex items-center justify-center gap-6 py-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <div className="text-center space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team 1</label>
                        <input id={`home-${match.id}`} type="number" placeholder="-" className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl text-center text-2xl font-black focus:border-world-cup-green focus:outline-none transition-all shadow-inner" />
                      </div>
                      <div className="text-3xl font-black text-gray-300 self-end mb-3">:</div>
                      <div className="text-center space-y-2">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Team 2</label>
                        <input id={`away-${match.id}`} type="number" placeholder="-" className="w-14 h-14 bg-white border-2 border-gray-200 rounded-xl text-center text-2xl font-black focus:border-world-cup-green focus:outline-none transition-all shadow-inner" />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest block text-center">ใครชนะในราคาต่อรอง? (Handicap Winner)</label>
                      <div className="grid grid-cols-3 gap-3">
                        <button 
                          onClick={() => setWinners({...winners, [match.id]: 'home'})}
                          className={`py-4 rounded-xl text-sm font-black border-2 transition-all ${winners[match.id] === 'home' ? 'bg-world-cup-green border-world-cup-green text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400 hover:border-world-cup-green/50'}`}
                        >
                          ทีม 1 ชนะ
                        </button>
                        <button 
                          onClick={() => setWinners({...winners, [match.id]: 'push'})}
                          className={`py-4 rounded-xl text-sm font-black border-2 transition-all ${winners[match.id] === 'push' ? 'bg-amber-500 border-amber-500 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400 hover:border-amber-500/50'}`}
                        >
                          ยกเลิก/เสมอ
                        </button>
                        <button 
                          onClick={() => setWinners({...winners, [match.id]: 'away'})}
                          className={`py-4 rounded-xl text-sm font-black border-2 transition-all ${winners[match.id] === 'away' ? 'bg-blue-500 border-blue-500 text-white shadow-lg' : 'bg-white border-gray-200 text-gray-400 hover:border-blue-500/50'}`}
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
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{match.homeTeam}</p>
                        <p className="text-giant font-black text-slate-800">{match.homeScore}</p>
                      </div>
                      <div className="text-giant font-black text-gray-300">-</div>
                      <div className="text-center">
                        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{match.awayTeam}</p>
                        <p className="text-giant font-black text-slate-800">{match.awayScore}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-center gap-2 text-sm font-black italic">
                       <span className="text-gray-400">ฝั่งชนะ:</span>
                       <span className="text-world-cup-green uppercase tracking-tighter">
                         {match.manualWinner === 'home' && `ทีม 1 (${match.homeTeam})`}
                         {match.manualWinner === 'away' && `ทีม 2 (${match.awayTeam})`}
                         {match.manualWinner === 'push' && 'ยกเลิก/เสมอ'}
                       </span>
                       <Check className="w-4 h-4 text-green-500" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
    </>
  )}
</div>
);
};

export default AdminDashboard;
