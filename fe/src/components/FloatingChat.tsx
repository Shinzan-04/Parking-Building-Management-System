import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { MessageCircle, X, Send, User, Bot, Headset } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

interface ChatMessage {
  id: string;
  content: string;
  sender: 'User' | 'Bot' | 'Agent';
  createdAt: string;
}

export const FloatingChat: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);
  const [status, setStatus] = useState<'BotHandling' | 'Escalated' | 'AgentHandling' | 'Closed'>('BotHandling');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Handle SignalR connection
  useEffect(() => {
    if (sessionId && !connection) {
      const newConnection = new signalR.HubConnectionBuilder()
        .withUrl(`${API_URL}/chatHub`)
        .withAutomaticReconnect()
        .build();

      newConnection.on('ReceiveMessage', (id: string, sender: string, content: string, createdAt: string) => {
        setMessages(prev => [...prev, { id, sender: sender as any, content, createdAt }]);
      });

      newConnection.on('SessionStatusChanged', (newStatus: string) => {
        setStatus(newStatus as any);
      });

      newConnection.start()
        .then(() => {
          newConnection.invoke('JoinSession', sessionId);
        })
        .catch(err => console.error('SignalR Connection Error: ', err));

      setConnection(newConnection);
    }
  }, [sessionId, connection]);

  const toggleChat = async () => {
    if (!isOpen && !sessionId) {
      // Start a new session when opened for the first time
      try {
        // Lấy GuestId từ localStorage hoặc tạo mới (giả lập)
        let guestId = localStorage.getItem('guest_id');
        if (!guestId) {
            guestId = 'guest_' + Math.random().toString(36).substring(7);
            localStorage.setItem('guest_id', guestId);
        }

        const res = await fetch(`${API_URL}/api/Chat/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
              guestId: guestId,
              buildingId: null // Backend sẽ tự lấy tòa nhà mặc định
          })
        });
        const data = await res.json();
        setSessionId(data.sessionId);
        
        // Push welcome message
        setMessages([
            {
                id: 'welcome',
                sender: 'Bot',
                content: 'Chào bạn, tôi là ParkAssist! Mình có thể giúp gì cho bạn về bãi đỗ xe hôm nay?',
                createdAt: new Date().toISOString()
            }
        ]);
      } catch (err) {
        console.error('Failed to start chat session', err);
      }
    }
    setIsOpen(!isOpen);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !connection || !sessionId) return;

    try {
      await connection.invoke('SendMessage', sessionId, inputText, 'User');
      setInputText('');
    } catch (err) {
      console.error('Send failed', err);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Nút bong bóng chat */}
      <button
        onClick={toggleChat}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
          isOpen ? 'bg-red-500 hover:bg-red-600 scale-90' : 'bg-blue-600 hover:bg-blue-700 scale-100 animate-bounce'
        }`}
      >
        {isOpen ? <X className="text-white" size={28} /> : <MessageCircle className="text-white" size={28} />}
      </button>

      {/* Cửa sổ chat */}
      <div
        className={`absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 transform origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
        style={{ height: '500px' }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 rounded-t-2xl text-white flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
             {status === 'AgentHandling' ? <Headset size={20} /> : <Bot size={20} />}
          </div>
          <div>
            <h3 className="font-bold text-lg leading-tight">
              {status === 'AgentHandling' ? 'Nhân viên Hỗ trợ' : 'ParkAssist AI'}
            </h3>
            <p className="text-xs text-blue-100">
              {status === 'Escalated' 
                  ? 'Đang kết nối nhân viên...' 
                  : (status === 'AgentHandling' ? 'Đang trực tuyến' : 'Trợ lý ảo 24/7')}
            </p>
          </div>
        </div>

        {/* Message Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((msg) => {
             // Ẩn các tag nội bộ của hệ thống
             const displayContent = msg.content.replace('[SUGGEST_LIVECHAT]', '').trim();
             if (!displayContent) return null;

             const isUser = msg.sender === 'User';
             return (
              <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
                    isUser 
                      ? 'bg-blue-600 text-white rounded-tr-sm' 
                      : msg.sender === 'Agent' 
                        ? 'bg-emerald-100 text-emerald-900 border border-emerald-200 rounded-tl-sm'
                        : 'bg-white text-gray-800 border border-gray-200 rounded-tl-sm'
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                </div>
              </div>
            );
          })}
          
          {/* Status Indicator */}
          {status === 'Escalated' && (
            <div className="flex justify-center">
               <span className="text-xs font-medium bg-amber-100 text-amber-800 px-3 py-1 rounded-full animate-pulse">
                  Đang tìm nhân viên trống để hỗ trợ bạn...
               </span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <form onSubmit={sendMessage} className="p-3 bg-white border-t border-gray-100 rounded-b-2xl flex items-center gap-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={status === 'Escalated'}
            placeholder={status === 'Escalated' ? 'Vui lòng đợi nhân viên...' : 'Nhập tin nhắn...'}
            className="flex-1 bg-gray-100 border-none rounded-full px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!inputText.trim() || status === 'Escalated'}
            className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors"
          >
            <Send size={18} className="ml-1" />
          </button>
        </form>
      </div>
    </div>
  );
};
