import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Crown, BarChart2, X, Sparkles } from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, CartesianGrid, LabelList } from 'recharts';
import { User } from '../types';

interface FinalSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
}

const FinalSummaryModal: React.FC<FinalSummaryModalProps> = ({ isOpen, onClose, users }) => {
  if (!isOpen) return null;

  // Filter out admins and sort by points descending
  const playerUsers = users
    .filter(u => u.role !== 'admin')
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  const champion = playerUsers[0];
  const runnerUp1 = playerUsers[1];
  const runnerUp2 = playerUsers[2];

  // Data for Recharts Bar Chart (Using FULL display names)
  const chartData = playerUsers.map((u, index) => ({
    name: u.displayName,
    points: u.points || 0,
    rank: index + 1
  }));

  // Custom colors for bars based on rank
  const getBarColor = (rank: number) => {
    if (rank === 1) return '#f59e0b'; // Gold
    if (rank === 2) return '#94a3b8'; // Silver
    if (rank === 3) return '#d97706'; // Bronze
    if (rank <= 5) return '#10b981';  // Emerald Top 5
    if (rank === playerUsers.length) return '#ef4444'; // Last place Red
    return '#3b82f6'; // Blue
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 z-50 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          className="bg-[#0b1329] border border-amber-500/40 rounded-[2.5rem] p-4 sm:p-6 max-w-6xl w-full max-h-[92vh] overflow-y-auto space-y-6 shadow-[0_25px_60px_rgba(245,158,11,0.25)] text-slate-100 relative"
        >
          {/* Header Bar */}
          <div className="flex justify-between items-center border-b border-amber-500/20 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/30">
                <Trophy className="w-7 h-7 fill-current" />
              </div>
              <div>
                <h2 className="text-xl sm:text-2xl font-black uppercase tracking-wider bg-gradient-to-r from-amber-300 via-yellow-400 to-amber-500 bg-clip-text text-transparent">
                  สรุปผลการแข่งขันบอลโลก 2026 🏆
                </h2>
                <p className="text-xs text-amber-400/80 font-bold uppercase tracking-widest">
                  WORLD CUP 2026 FINAL STANDINGS & SUMMARY CHART
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-all text-xl cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Podium / Winners Banner */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Champion 1st */}
            {champion && (
              <div className="md:col-span-2 bg-gradient-to-br from-amber-950/40 via-yellow-950/20 to-slate-900 border-2 border-amber-500/60 rounded-3xl p-5 relative overflow-hidden shadow-lg shadow-amber-500/10 flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-4 opacity-20 text-amber-400">
                  <Crown className="w-24 h-24" />
                </div>
                <div className="space-y-2 relative z-10">
                  <div className="inline-flex items-center gap-2 bg-amber-500 text-slate-950 font-black px-3.5 py-1 rounded-full text-xs uppercase tracking-widest shadow-md">
                    <Sparkles className="w-3.5 h-3.5 fill-current" /> 🏆 แชมป์รวยฟ้าผ่า (CHAMPION)
                  </div>
                  <h3 className="text-2xl sm:text-3xl font-black text-white tracking-tight pt-1">
                    {champion.displayName}
                  </h3>
                  <p className="text-slate-400 text-xs font-bold">
                    คะแนนรวมสูงสุดในรายการแข่งขัน
                  </p>
                </div>
                <div className="pt-4 flex items-end justify-between border-t border-amber-500/20 mt-4 relative z-10">
                  <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">คะแนนสุทธิ</span>
                  <span className="text-4xl font-black text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.5)]">
                    {champion.points} <span className="text-sm font-bold text-slate-400">PTS</span>
                  </span>
                </div>
              </div>
            )}

            {/* 2nd Place */}
            {runnerUp1 && (
              <div className="bg-gradient-to-br from-slate-800/40 to-slate-900 border border-slate-400/40 rounded-3xl p-4 flex flex-col justify-between shadow-inner">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 bg-slate-400 text-slate-950 font-black px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    🥈 รองแชมป์อันดับ 1
                  </div>
                  <h4 className="text-lg font-black text-white truncate pt-1">
                    {runnerUp1.displayName}
                  </h4>
                </div>
                <div className="pt-3 flex items-end justify-between border-t border-slate-800 mt-3">
                  <span className="text-[10px] font-bold text-slate-400">คะแนนรวม</span>
                  <span className="text-2xl font-black text-slate-200">
                    {runnerUp1.points} <span className="text-xs font-bold text-slate-500">PTS</span>
                  </span>
                </div>
              </div>
            )}

            {/* 3rd Place */}
            {runnerUp2 && (
              <div className="bg-gradient-to-br from-amber-950/20 to-slate-900 border border-amber-700/40 rounded-3xl p-4 flex flex-col justify-between shadow-inner">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 bg-amber-700 text-white font-black px-2.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider">
                    🥉 รองแชมป์อันดับ 2
                  </div>
                  <h4 className="text-lg font-black text-white truncate pt-1">
                    {runnerUp2.displayName}
                  </h4>
                </div>
                <div className="pt-3 flex items-end justify-between border-t border-slate-800 mt-3">
                  <span className="text-[10px] font-bold text-slate-400">คะแนนรวม</span>
                  <span className="text-2xl font-black text-amber-500">
                    {runnerUp2.points} <span className="text-xs font-bold text-slate-500">PTS</span>
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Chart Header */}
          <div className="bg-slate-900/60 p-3 rounded-2xl border border-slate-800 flex justify-between items-center">
            <div className="flex items-center gap-2 pl-2">
              <BarChart2 className="w-5 h-5 text-emerald-400" />
              <span className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
                กราฟสรุปคะแนนแนวตั้งแสดงชื่อฉายาเต็มทุกคน (VERTICAL FINAL STANDINGS CHART)
              </span>
            </div>
          </div>

          {/* Recharts VERTICAL Bar Chart Display */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-4">
            <div className="h-[450px] sm:h-[500px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 30, right: 20, left: 10, bottom: 100 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="name" 
                    stroke="#94a3b8" 
                    fontSize={11} 
                    fontWeight="bold"
                    interval={0}
                    angle={-45}
                    textAnchor="end"
                    height={100}
                  />
                  <YAxis 
                    type="number" 
                    stroke="#64748b" 
                    fontSize={11} 
                    fontWeight="bold"
                  />
                  <Tooltip
                    contentStyle={{ 
                      backgroundColor: '#0f172a', 
                      borderColor: '#334155',
                      borderRadius: '1rem',
                      color: '#f8fafc',
                      fontWeight: 'bold',
                      fontSize: '12px'
                    }}
                    formatter={(value: any) => [`${value} คะแนน`, 'คะแนนสะสม']}
                    labelFormatter={(label: any) => `สมาชิก: ${label}`}
                  />
                  <Bar dataKey="points" radius={[8, 8, 0, 0]}>
                    <LabelList dataKey="points" position="top" fill="#f8fafc" fontSize={11} fontWeight="900" />
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={getBarColor(entry.rank)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Actions */}
          <div className="border-t border-slate-800 pt-4 flex justify-between items-center">
            <div className="text-xs font-bold text-slate-400">
              สมาชิกทั้งหมด {playerUsers.length} ท่าน
            </div>
            <button
              onClick={onClose}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black px-6 py-3 rounded-2xl text-xs uppercase tracking-wider shadow-lg transition-all cursor-pointer"
            >
              ปิดหน้าต่างสรุปผล
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default FinalSummaryModal;
