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
      className="wc-glass rounded-[2rem] p-6 shadow-xl border border-gray-100 overflow-hidden"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-8 h-8 bg-world-cup-green rounded-full flex items-center justify-center text-white shadow-lg">
          <span className="text-xs font-black">📈</span>
        </div>
        <div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest">คะแนนภาพรวม</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-tight">Real-time Stats</p>
        </div>
      </div>

      <div className="h-[400px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
          >
            <XAxis type="number" hide />
            <YAxis 
              dataKey="name" 
              type="category" 
              width={80} 
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 800, fill: '#64748b' }}
            />
            <Tooltip 
              cursor={{ fill: 'transparent' }}
              contentStyle={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderRadius: '16px',
                border: 'none',
                boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                padding: '12px'
              }}
              labelStyle={{ fontWeight: 900, marginBottom: '4px', color: '#1e293b', fontSize: '12px' }}
              itemStyle={{ fontWeight: 800, fontSize: '14px', color: '#22c55e' }}
            />
            <Bar 
              dataKey="points" 
              radius={[0, 10, 10, 0]} 
              animationDuration={1500}
              label={{ 
                position: 'right', 
                fill: '#1e293b', 
                fontSize: 12, 
                fontWeight: 900,
                formatter: (val: number) => `${val}`
              }}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={index === chartData.length - 1 ? '#eab308' : '#22c55e'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
};

export default ScoreGraph;
