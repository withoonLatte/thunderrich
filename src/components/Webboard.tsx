import React, { useEffect, useState, useRef } from 'react';
import { collection, onSnapshot, query, orderBy, limit, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Message } from '../types';
import { MessageSquare, Send } from 'lucide-react';
import { format } from 'date-fns';

const Webboard: React.FC = () => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'webboard'), orderBy('createdAt', 'desc'), limit(50));
    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)).reverse();
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newMessage.trim()) return;

    const text = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'webboard'), {
        userId: user.uid,
        displayName: user.displayName,
        content: text,
        createdAt: Timestamp.now()
      });
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  return (
    <div className="flex flex-col h-[700px] bg-[#0f172a]/95 backdrop-blur-3xl rounded-[2.2rem] overflow-hidden border border-slate-800/80 shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md flex items-center justify-between">
        <h3 className="text-base font-black text-white uppercase tracking-widest flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-emerald-400" /> เว็บบอร์ดแฟนบอล
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.7)]"></div>
          <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">ONLINE</span>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar bg-[#090d1a]/55"
      >
        {messages.map((msg) => {
          const isMe = msg.userId === user?.uid;
          const initials = msg.displayName ? msg.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
          
          return (
            <div key={msg.id} className={`flex gap-4.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 shadow-lg transform rotate-3 ${
                isMe 
                  ? 'bg-gradient-to-r from-blue-600 to-fuchsia-600 text-white border border-fuchsia-500/20' 
                  : 'bg-slate-800 text-emerald-400 border border-slate-700'
              }`}>
                {initials}
              </div>

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] animate-in fade-in slide-in-from-bottom-2`}>
                <div className="flex items-center gap-3 mb-2 px-1.5">
                   <span className="text-xs font-black text-slate-300 uppercase tracking-wider">{msg.displayName}</span>
                   <span className="text-[10px] font-bold text-slate-500">
                     {msg.createdAt ? format(new Date(msg.createdAt.seconds * 1000), 'HH:mm') : '...'}
                   </span>
                </div>
                <div className={`px-6 py-4.5 rounded-3xl text-base font-bold leading-relaxed shadow-xl border ${
                  isMe 
                    ? 'bg-gradient-to-r from-emerald-500 to-green-500 text-slate-950 rounded-tr-none border-emerald-500/25 shadow-emerald-500/5' 
                    : 'bg-slate-800/90 text-slate-100 rounded-tl-none border-slate-700/60'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-5 bg-slate-900/80 border-t border-slate-800/80">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="คุยเกทับเพื่อนรักหน่อย..."
            className="flex-1 bg-slate-950 border-2 border-slate-800/80 rounded-2xl px-6 py-5 text-base font-black text-white focus:outline-none focus:border-fuchsia-500 focus:bg-slate-950 transition-all placeholder:text-slate-600 focus:ring-4 focus:ring-fuchsia-500/10"
          />
          <button 
            type="submit"
            className="wc-btn-neon bg-gradient-to-r from-blue-600 to-fuchsia-600 text-white px-7 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-fuchsia-600/30 flex items-center justify-center shrink-0 border border-fuchsia-500/20 cursor-pointer"
          >
            <Send className="w-6 h-6 fill-current" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Webboard;
