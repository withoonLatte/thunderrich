import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { User } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion } from 'motion/react';

const ScoreGraph: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('points', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      const data = snap.docs
        .map(d => d.data() as User)
        .filter(u => u.role !== 'admin')
        .slice(0, 15);
      setUsers(data);
    });

    return () => unsubscribe();
  }, []);

  const chartData = users.map(u => ({
    name: u.displayName,
    points: u.points
  })).reverse(); // Reverse for horizontal bar chart top-to-bottom feel

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[#0f172a]/90 backdrop-blur-2xl rounded-[2rem] p-6 shadow-[0_15px_40px_rgba(0,0,0,0.4)] border border-slate-800/80 overflow-hidden"
    >
      <div className="flex items-center gap-3.5 mb-6">
        <div className="w-9 h-9 bg-gradient-to-br from-yellow-400 via-fuchsia-500 to-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg">
          <span className="text-sm font-black">📈</span>
        </div>
        <div>
          <h3 className="text-base font-black text-white uppercase tracking-wider">คะแนนภาพรวม</h3>
          <p className="text-[11px] text-fuchsia-400 font-black uppercase tracking-widest">Real-time Stats Standings</p>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 10, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={90} 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 11, fontWeight: 900, fill: '#cbd5e1' }}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(255, 255, 255, 0.05)' }}
              contentStyle={{ 
                backgroundColor: '#0f172a',
                borderRadius: '16px',
                border: '1.5px solid #334155',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                padding: '12px'
              }}
              labelStyle={{ fontWeight: 900, marginBottom: '4px', color: '#ffffff', fontSize: '13px' }}
              itemStyle={{ fontWeight: 800, fontSize: '14px', color: '#22c55e' }}
            />
            <Bar 
              dataKey="points" 
              radius={[0, 8, 8, 0]} 
              animationDuration={1500}
              label={{ 
                position: 'right', 
                fill: '#ffffff', 
                fontSize: 12, 
                fontWeight: 900,
                offset: 8,
                formatter: (val: number) => `${val}`
              }}
            >
              {chartData.map((entry, index) => {
                const rankFromTop = chartData.length - 1 - index;
                let fill = '#22c55e'; // Default Green
                if (rankFromTop === 0) fill = '#facc15'; // 1st: Gold
                else if (rankFromTop === 1) fill = '#94a3b8'; // 2nd: Silver
                else if (rankFromTop === 2) fill = '#b45309'; // 3rd: Bronze
                else if (rankFromTop < 5) fill = '#ec4899'; // Top 5: Fuchsia Pink
                
                return (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={fill} 
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default ScoreGraph;
