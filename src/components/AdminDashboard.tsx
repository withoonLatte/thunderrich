import React, { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, query, orderBy, doc, updateDoc, Timestamp, deleteDoc, writeBatch, getDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { TournamentRound, Match, MatchStatus, User } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { calculateMatchResults } from '../lib/gameLogic';
import { Trash2, Edit3, CheckCircle, PlusCircle, RefreshCw, Calendar, ChevronDown, Check, Camera, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { WORLD_CUP_2026_SCHEDULE, MockMatch } from '../data/worldCupSchedule';

const AdminDashboard: React.FC = () => {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeAdminTab, setActiveAdminTab] = useState<'matches' | 'players'>('matches');
  const [showAdd, setShowAdd] = useState(false);
  
  // Create User State
  const [newUsername, setNewUsername] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [userCreationLoading, setUserCreationLoading] = useState(false);
  const [userCreationMessage, setUserCreationMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // Match Form State
  const [homeTeam, setHomeTeam] = useState('');
  const [awayTeam, setAwayTeam] = useState('');
  const [handicap, setHandicap] = useState('0');
  const [round, setRound] = useState<TournamentRound>(TournamentRound.GROUP);
  const [startTime, setStartTime] = useState('');
  
  const [calcLoading, setCalcLoading] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [showMockList, setShowMockList] = useState(false);
  const [uploadingUid, setUploadingUid] = useState<string | null>(null);

  useEffect(() => {
    const unsubMatches = onSnapshot(query(collection(db, 'matches'), orderBy('startTime', 'desc')), (snap) => {
      setMatches(snap.docs.map(d => ({ id: d.id, ...d.data() } as Match)));
    });
    
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as User));
    });

    return () => {
      unsubMatches();
      unsubUsers();
    };
  }, []);

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

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserCreationLoading(true);
    setUserCreationMessage(null);
    
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          adminUid: user?.uid,
          username: newUsername,
          password: newPassword,
          displayName: newDisplayName
        })
      });

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || data.message || 'สร้างผู้ใช้ไม่สำเร็จ');
        }
        setUserCreationMessage({ type: 'success', text: `สร้างผู้ใช้ ${newUsername} สำเร็จ!` });
        setNewUsername('');
        setNewDisplayName('');
        setNewPassword('');
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        // If it's a 404, suggest a retry or check
        if (response.status === 404) {
          throw new Error(`ไม่พบเส้นทาง API (404) - ${text.substring(0, 100)}`);
        }
        throw new Error(`เกิดข้อผิดพลาดจากเซิร์ฟเวอร์ (รหัส: ${response.status})`);
      }
    } catch (err: any) {
      setUserCreationMessage({ type: 'error', text: err.message });
    } finally {
      setUserCreationLoading(false);
    }
  };

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!homeTeam || !awayTeam || !startTime) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const date = new Date(startTime);
    
    await addDoc(collection(db, 'matches'), {
      homeTeam,
      awayTeam,
      homeFlag: `https://flagcdn.com/w80/${getCountryCode(homeTeam)}.png`, 
      awayFlag: `https://flagcdn.com/w80/${getCountryCode(awayTeam)}.png`,
      handicap: handicap,
      round,
      startTime: Timestamp.fromDate(date),
      status: MatchStatus.SCHEDULED
    } as any);

    setShowAdd(false);
    resetForm();
  };

  const getCountryCode = (team: string) => {
    const codes: Record<string, string> = {
      'Mexico': 'mx', 'USA': 'us', 'Canada': 'ca', 'England': 'gb',
      'Argentina': 'ar', 'France': 'fr', 'Brazil': 'br', 'Germany': 'de',
      'Japan': 'jp', 'Spain': 'es', 'Thailand': 'th', 'South Korea': 'kr'
    };
    return codes[team] || team.substring(0, 2).toLowerCase();
  };

  const selectMockMatch = (m: MockMatch) => {
    setHomeTeam(m.homeTeam);
    setAwayTeam(m.awayTeam);
    setRound(m.round);
    setStartTime(format(new Date(m.startTime), "yyyy-MM-dd'T'HH:mm"));
    setShowMockList(false);
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

  const resetForm = () => {
    setHomeTeam('');
    setAwayTeam('');
    setHandicap('0');
    setStartTime('');
  };

  const deleteMatch = async (id: string) => {
    if (window.confirm('ลบแมตช์นี้?')) {
      await deleteDoc(doc(db, 'matches', id));
    }
  };

  const setScores = async (matchId: string, home: number, away: number) => {
    await updateDoc(doc(db, 'matches', matchId), {
      homeScore: home,
      awayScore: away,
      status: MatchStatus.FINISHED
    });
    
    setCalcLoading(matchId);
    await calculateMatchResults(matchId);
    setCalcLoading(null);
  };

  const handleTestPing = async () => {
    try {
      const resp = await fetch('/api/ping');
      const data = await resp.json();
      alert(`API Connection: ${data.message} at ${data.time}`);
    } catch (err: any) {
      alert(`API Error: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div className="flex justify-between items-center text-world-cup-green">
          <div className="flex items-center gap-2">
            <h2 className="text-xl italic">ระบบจัดการแอดมิน</h2>
            <button 
              onClick={handleTestPing}
              className="text-[8px] bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded border border-white/10 text-gray-500 uppercase tracking-tighter"
            >
              Ping API
            </button>
          </div>
          <div className="bg-white/5 p-1 rounded-lg flex">
            <button 
              onClick={() => setActiveAdminTab('matches')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest transition-all ${activeAdminTab === 'matches' ? 'bg-world-cup-green text-white shadow-lg' : 'text-gray-500'}`}
            >
              แมตช์การแข่งขัน
            </button>
            <button 
              onClick={() => setActiveAdminTab('players')}
              className={`px-3 py-1.5 rounded-md text-[10px] uppercase tracking-widest transition-all ${activeAdminTab === 'players' ? 'bg-world-cup-green text-white shadow-lg' : 'text-gray-500'}`}
            >
              ผู้เล่น
            </button>
          </div>
        </div>

        {activeAdminTab === 'matches' && (
          <div className="flex gap-2">
            <button 
              disabled={resetLoading}
              onClick={handleResetForKnockout}
              className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white px-4 py-3 rounded-2xl text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${resetLoading ? 'animate-spin' : ''}`} />
              รีเซ็ตเฟส
            </button>
            <button 
              onClick={() => setShowAdd(!showAdd)}
              className="flex-1 flex items-center justify-center gap-2 bg-world-cup-green text-white px-4 py-3 rounded-2xl text-xs"
            >
              {showAdd ? 'ปิด' : <><PlusCircle className="w-4 h-4" /> เพิ่มแมตช์</>}
            </button>
          </div>
        )}
      </div>

      {activeAdminTab === 'players' && (
        <div className="space-y-6">
          <form onSubmit={handleCreateUser} className="wc-glass p-6 rounded-3xl space-y-4 border-t-2 border-world-cup-green/20">
            <h3 className="text-sm text-white italic uppercase tracking-wider mb-2">สร้างบัญชีผู้เล่น</h3>
            
            {userCreationMessage && (
              <div className={`p-4 rounded-2xl text-xs ${userCreationMessage.type === 'success' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-red-500/10 text-red-500 border border-red-500/20'}`}>
                {userCreationMessage.text}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] text-gray-500 uppercase px-2">ชื่อที่ใช้แสดง</label>
              <input required value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} placeholder="เช่น Messi FC" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-world-cup-green" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase px-2">ชื่อผู้ใช้</label>
                <input required value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="leo10" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-world-cup-green" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-gray-500 uppercase px-2">รหัสผ่าน</label>
                <input required type="text" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="secret" className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm focus:outline-none focus:border-world-cup-green" />
              </div>
            </div>

            <button 
              disabled={userCreationLoading}
              type="submit" 
              className="w-full bg-world-cup-green text-white py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {userCreationLoading ? 'กำลังสร้าง...' : 'เพิ่มเพื่อนเข้าระบบ'}
            </button>
          </form>

          <div className="space-y-3">
            <h3 className="text-[10px] text-gray-500 uppercase tracking-[0.2em] px-2 text-center">รายชื่อผู้เล่น ({users.length}/15)</h3>
            {users.map(u => (
              <div key={u.uid} className="wc-glass p-4 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative group">
                    <div className="w-12 h-12 rounded-full bg-world-cup-green/20 overflow-hidden flex items-center justify-center text-xs text-world-cup-green border-2 border-world-cup-green/30">
                      {u.photoURL ? (
                        <img src={u.photoURL} alt={u.displayName} className="w-full h-full object-cover" />
                      ) : (
                        u.displayName[0].toUpperCase()
                      )}
                    </div>
                    <label className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handlePhotoUpload(u.uid, file);
                        }}
                      />
                      {uploadingUid === u.uid ? (
                        <Loader2 className="w-4 h-4 text-white animate-spin" />
                      ) : (
                        <Camera className="w-4 h-4 text-white" />
                      )}
                    </label>
                  </div>
                  <div>
                    <p className="text-sm text-white">{u.displayName}</p>
                    <p className="text-[10px] text-gray-500 tracking-tight">{u.email}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs text-world-cup-gold">{u.points} คะแนน</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeAdminTab === 'matches' && (
        <>
          {showAdd && (
            <div className="space-y-4">
              <div className="wc-glass p-4 rounded-2xl flex flex-col gap-3">
                <button 
                  type="button"
                  onClick={() => setShowMockList(!showMockList)}
                  className="flex items-center justify-between w-full bg-white/5 p-4 rounded-xl border border-white/10 text-sm text-world-cup-gold"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    {showMockList ? 'ปิดรายการแมตช์แนะนำ' : 'เลือกจากรายการแมตช์แนะนำ (World Cup 2026)'}
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showMockList ? 'rotate-180' : ''}`} />
                </button>

                {showMockList && (
                  <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto no-scrollbar pt-2">
                    {WORLD_CUP_2026_SCHEDULE.map((m, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => selectMockMatch(m)}
                        className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-transparent hover:border-world-cup-green/50 hover:bg-world-cup-green/5 transition-all text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex -space-x-2">
                            <img src={m.homeFlag} className="w-6 h-4 rounded-sm border border-white/20" />
                            <img src={m.awayFlag} className="w-6 h-4 rounded-sm border border-white/20" />
                          </div>
                          <span className="text-xs text-white">{m.homeTeam} vs {m.awayTeam}</span>
                        </div>
                        <span className="text-[10px] text-gray-500">{format(new Date(m.startTime), 'MMM d, HH:mm')}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={handleAddMatch} className="wc-glass p-6 rounded-2xl space-y-4 border-t-2 border-world-cup-gold/30">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">เจ้าบ้าน</label>
                    <input required value={homeTeam} onChange={e => setHomeTeam(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-world-cup-green" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">ทีมเยือน</label>
                    <input required value={awayTeam} onChange={e => setAwayTeam(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-world-cup-green" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">แต้มต่อ (เจ้าบ้าน)</label>
                    <input type="text" required value={handicap} onChange={e => setHandicap(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-world-cup-green" placeholder="เช่น 0/0.5 หรือ เสมอ" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-gray-500 uppercase">รอบการแข่งขัน</label>
                    <select value={round} onChange={e => setRound(e.target.value as TournamentRound)} className="w-full bg-world-cup-purple border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-world-cup-green">
                      <option value={TournamentRound.GROUP}>รอบแบ่งกลุ่ม</option>
                      <option value={TournamentRound.TOP16}>รอบ 16 ทีม</option>
                      <option value={TournamentRound.TOP8}>รอบ 8 ทีม</option>
                      <option value={TournamentRound.TOP4}>รอบรองชนะเลิศ</option>
                      <option value={TournamentRound.THIRD_PLACE}>ชิงอันดับ 3</option>
                      <option value={TournamentRound.FINAL}>รอบชิงชนะเลิศ</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-gray-500 uppercase">เวลาแข่ง</label>
                  <input type="datetime-local" required value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm focus:outline-none focus:border-world-cup-green text-white" />
                </div>
                <button type="submit" className="w-full bg-world-cup-green text-white py-4 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all">
                  บันทึกแมตช์
                </button>
              </form>
            </div>
          )}

      <div className="space-y-4">
        {matches.map(match => (
          <div key={match.id} className="wc-glass rounded-2xl p-4 flex flex-col gap-4 border-l-4 border-world-cup-green">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[10px] text-world-cup-green uppercase">
                  {match.round === TournamentRound.GROUP && 'รอบแบ่งกลุ่ม'}
                  {match.round === TournamentRound.TOP16 && 'รอบ 16 ทีม'}
                  {match.round === TournamentRound.TOP8 && 'รอบ 8 ทีม'}
                  {match.round === TournamentRound.TOP4 && 'รอบรองชนะเลิศ'}
                  {match.round === TournamentRound.THIRD_PLACE && 'ชิงอันดับ 3'}
                  {match.round === TournamentRound.FINAL && 'รอบชิงชนะเลิศ'}
                </p>
                <h3 className="">{match.homeTeam} vs {match.awayTeam}</h3>
                <p className="text-[10px] text-gray-500">{format(new Date(match.startTime.seconds * 1000), 'MMM d, HH:mm')} | H: {match.handicap}</p>
              </div>
              <button onClick={() => deleteMatch(match.id)} className="text-red-500 p-2"><Trash2 className="w-4 h-4" /></button>
            </div>

            {match.status !== MatchStatus.FINISHED ? (
              <div className="flex items-center gap-2">
                <input id={`home-${match.id}`} type="number" placeholder="H" className="w-16 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-sm" />
                <span className="text-gray-500">-</span>
                <input id={`away-${match.id}`} type="number" placeholder="A" className="w-16 bg-white/5 border border-white/10 rounded-lg p-2 text-center text-sm" />
                <button 
                  onClick={() => {
                    const h = (document.getElementById(`home-${match.id}`) as HTMLInputElement).value;
                    const a = (document.getElementById(`away-${match.id}`) as HTMLInputElement).value;
                    if (h && a) setScores(match.id, Number(h), Number(a));
                  }}
                  className="flex-1 bg-world-cup-green text-white py-2 rounded-lg text-xs flex items-center justify-center gap-2"
                >
                  {calcLoading === match.id ? 'กำลังคำนวณ...' : <><CheckCircle className="w-4 h-4" /> ใส่ผลการแข่ง</>}
                </button>
              </div>
            ) : (
              <div className="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/10">
                <span className="text-xs text-gray-500 uppercase">จบการแข่งขัน</span>
                <span className="text-world-cup-gold">{match.homeScore} - {match.awayScore}</span>
                <span className="text-xs text-green-500">เสร็จสมบูรณ์</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )}
</div>
);
};

export default AdminDashboard;
