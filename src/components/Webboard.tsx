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
    <div className="flex flex-col h-[700px] wc-glass rounded-[2rem] overflow-hidden border border-gray-100 shadow-2xl">
      <div className="p-6 border-b border-gray-100 bg-white/50 backdrop-blur-md flex items-center justify-between">
        <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-3">
          <MessageSquare className="w-5 h-5 text-world-cup-green" /> เว็บบอร์ดแฟนบอล
        </h3>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-world-cup-green rounded-full animate-pulse shadow-[0_0_12px_rgba(34,197,94,0.6)]"></div>
          <span className="text-xs font-black text-world-cup-green uppercase tracking-tighter">ONLINE</span>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar bg-gray-50/30"
      >
        {messages.map((msg) => {
          const isMe = msg.userId === user?.uid;
          const initials = msg.displayName ? msg.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : '??';
          
          return (
            <div key={msg.id} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xs font-black shrink-0 shadow-lg transform rotate-3 ${
                isMe ? 'bg-slate-900 text-white' : 'bg-white text-world-cup-green border-2 border-gray-100'
              }`}>
                {initials}
              </div>

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[85%] animate-in fade-in slide-in-from-bottom-2`}>
                <div className="flex items-center gap-3 mb-2 px-1">
                   <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{msg.displayName}</span>
                   <span className="text-[10px] font-bold text-gray-300">
                     {msg.createdAt ? format(new Date(msg.createdAt.seconds * 1000), 'HH:mm') : '...'}
                   </span>
                </div>
                <div className={`px-6 py-4 rounded-3xl text-sm font-medium leading-relaxed shadow-xl border ${
                  isMe 
                    ? 'bg-world-cup-green text-white rounded-tr-none border-world-cup-green' 
                    : 'bg-white text-slate-700 rounded-tl-none border-gray-100'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-5 bg-white border-t border-gray-100">
        <form onSubmit={handleSubmit} className="flex gap-4">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="คุยอะไรหน่อย..."
            className="flex-1 bg-gray-50 border-2 border-gray-100 rounded-2xl px-6 py-5 text-base font-bold text-slate-800 focus:outline-none focus:border-world-cup-green focus:bg-white transition-all placeholder:text-gray-300"
          />
          <button 
            type="submit"
            className="bg-world-cup-green text-white px-6 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl shadow-world-cup-green/30 flex items-center justify-center shrink-0"
          >
            <Send className="w-7 h-7" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Webboard;
