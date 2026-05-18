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
    <div className="flex flex-col h-[600px] wc-glass rounded-3xl overflow-hidden border border-white/5">
      <div className="p-4 border-b border-white/5 bg-white/5 flex items-center justify-between">
        <h3 className="text-xs text-world-cup-gold uppercase tracking-[0.2em] flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> ห้องแชทส่วนรวม
        </h3>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-world-cup-green rounded-full animate-pulse shadow-[0_0_8px_#1DB954]"></div>
          <span className="text-[10px] text-gray-500">สด</span>
        </div>
      </div>
      
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 no-scrollbar scrolling-touch"
      >
        {messages.map((msg) => {
          const isMe = msg.userId === user?.uid;
          const initials = msg.displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
          
          return (
            <div key={msg.id} className={`flex gap-3 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
              {/* Avatar Placeholder */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[10px] shrink-0 shadow-lg ${
                isMe ? 'bg-world-cup-green text-white' : 'bg-white/10 text-gray-400 border border-white/10'
              }`}>
                {initials}
              </div>

              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[80%]`}>
                <div className="flex items-center gap-2 mb-1 px-1">
                   <span className="text-[10px] text-gray-500 uppercase tracking-wider">{msg.displayName}</span>
                   <span className="text-[9px] text-gray-600">
                     {msg.createdAt ? format(new Date(msg.createdAt.seconds * 1000), 'HH:mm') : '...'}
                   </span>
                </div>
                <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xl ${
                  isMe 
                    ? 'bg-world-cup-green text-white rounded-tr-none' 
                    : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/5'
                }`}>
                  {msg.content}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-blue-950/40 border-t border-white/10 backdrop-blur-xl">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <input 
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="พิมพ์ข้อความของคุณ..."
            className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-sm focus:outline-none focus:ring-2 focus:ring-world-cup-green/50 transition-all placeholder:text-gray-600"
          />
          <button 
            type="submit"
            className="bg-world-cup-green text-white p-4 rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-lg shadow-world-cup-green/30 flex items-center justify-center shrink-0"
          >
            <Send className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Webboard;
