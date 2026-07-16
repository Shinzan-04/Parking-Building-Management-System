import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { MessageCircle, X, Send, User, Bot, Headset, MapPin } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

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
  
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [hasSubmittedInfo, setHasSubmittedInfo] = useState(false);
  const [buildings, setBuildings] = useState<any[]>([]);
  const { user } = useAuth();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-submit info if logged in and escalated
  useEffect(() => {
    if (status === 'Escalated' && !hasSubmittedInfo && sessionId) {
      const userRaw = localStorage.getItem('sp_user');
      const currentUser = userRaw ? JSON.parse(userRaw) : user;
      
      if (currentUser) {
        const autoSubmit = async () => {
          try {
            await fetch(`${API_URL}/api/Chat/${sessionId}/guest-info`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name: currentUser.fullName || 'User', phone: currentUser.phoneNumber || currentUser.email || 'N/A' })
            });
            setHasSubmittedInfo(true);
          } catch (err) {
            console.error('Lỗi tự động lưu thông tin:', err);
          }
        };
        autoSubmit();
      }
    }
  }, [status, hasSubmittedInfo, sessionId, user]);

  // Fetch buildings
  useEffect(() => {
    fetch(`${API_URL}/api/Buildings`)
      .then(res => res.json())
      .then(data => setBuildings(data))
      .catch(console.error);
  }, []);

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

  const startChatSession = async (bId: string) => {
    try {
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
            buildingId: bId
        })
      });
      const data = await res.json();
      setSessionId(data.sessionId);
      localStorage.setItem('chat_session_id', data.sessionId);
      
      setMessages([
          {
              id: 'welcome',
              sender: 'Bot',
              content: 'Chào bạn, tôi là ParkAssist! Mình có thể giúp gì cho bạn về bãi đỗ xe hôm nay?',
              createdAt: new Date().toISOString()
          }
      ]);
    } catch (err) {
      console.error('Lỗi khi bắt đầu chat:', err);
    }
  };

  const toggleChat = () => {
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

  const submitGuestInfo = async () => {
    if (!sessionId || !guestName.trim() || !guestPhone.trim()) return;
    try {
      await fetch(`${API_URL}/api/Chat/${sessionId}/guest-info`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: guestName, phone: guestPhone })
      });
      setHasSubmittedInfo(true);
    } catch (err) {
      console.error('Lỗi lưu thông tin:', err);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <button
        onClick={toggleChat}
        className={`w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
          isOpen ? 'bg-red-600 hover:bg-red-700 scale-90' : 'bg-[#FF4C4C] hover:bg-red-600 scale-100 animate-bounce'
        }`}
      >
        {isOpen ? <X className="text-white" size={28} /> : <MessageCircle className="text-white" size={28} />}
      </button>

      <div
        className={`absolute bottom-20 right-0 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col transition-all duration-300 transform origin-bottom-right ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0 pointer-events-none'
        }`}
        style={{ height: '500px' }}
      >
        <div className="bg-gradient-to-r from-gray-900 to-black p-4 rounded-t-2xl text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                 {status === 'AgentHandling' ? <Headset size={20} /> : <Bot size={20} />}
              </div>
              <div>
                <h3 className="font-bold text-lg leading-tight">
                  {status === 'AgentHandling' ? 'Nhân viên Hỗ trợ' : 'ParkAssist AI'}
                </h3>
                <p className="text-xs text-gray-300">
                  {status === 'Escalated' 
                      ? 'Đang kết nối nhân viên...' 
                      : (status === 'AgentHandling' ? 'Đang trực tuyến' : 'Trợ lý ảo 24/7')}
                </p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
            </button>
        </div>

        {!sessionId ? (
          <div className="flex-1 p-6 flex flex-col bg-gray-50 overflow-y-auto">
            <div className="mb-6">
               <h3 className="font-bold text-lg text-gray-800">Chào mừng bạn! 👋</h3>
               <p className="text-sm text-gray-600 mt-2">Vui lòng chọn Tòa nhà mà bạn muốn liên hệ hoặc cần hỗ trợ đỗ xe:</p>
            </div>
            <div className="space-y-3">
              {buildings.map(b => (
                <button 
                  key={b.id} 
                  onClick={() => startChatSession(b.id)}
                  className="w-full text-left p-4 rounded-xl border border-gray-200 bg-white hover:border-[#FF4C4C] hover:shadow-md transition-all flex items-center justify-between group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-[#FF4C4C] group-hover:bg-[#FF4C4C] group-hover:text-white transition-colors">
                      <MapPin size={18} />
                    </div>
                    <div>
                      <span className="font-bold text-gray-800 block text-sm">{b.name}</span>
                      <span className="text-xs text-gray-500 block truncate max-w-[200px]">{b.address}</span>
                    </div>
                  </div>
                  <span className="text-gray-300 group-hover:text-[#FF4C4C] transition-colors">→</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
              {messages.map((msg) => {
                 const displayContent = msg.content.replace('[SUGGEST_LIVECHAT]', '').trim();
                 if (!displayContent) return null;

                 const isUser = msg.sender === 'User';
                 return (
                  <div key={msg.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] p-3 rounded-2xl shadow-sm ${
                        isUser 
                          ? 'bg-[#FF4C4C] text-white rounded-tr-sm' 
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
              
              {status === 'Escalated' && !hasSubmittedInfo && !localStorage.getItem('sp_user') && !user && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mx-2">
                  <p className="text-sm font-medium mb-3 text-gray-800">Để lại thông tin để nhân viên liên hệ:</p>
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      placeholder="Tên của bạn" 
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      className="w-full text-gray-900 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#FF4C4C]"
                    />
                    <input 
                      type="text" 
                      placeholder="Số điện thoại" 
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      className="w-full text-gray-900 text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 outline-none focus:border-[#FF4C4C]"
                    />
                    <button 
                      type="button"
                      onClick={submitGuestInfo}
                      disabled={!guestName.trim() || !guestPhone.trim()}
                      className="w-full bg-[#FF4C4C] text-white text-sm font-medium py-2 rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                      Gửi thông tin
                    </button>
                  </div>
                </div>
              )}
              
              {status === 'Escalated' && (
                <div className="flex justify-center">
                   <span className="text-xs font-medium bg-amber-100 text-amber-800 px-3 py-1 rounded-full animate-pulse">
                      Đang tìm nhân viên trống để hỗ trợ bạn...
                   </span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {status === 'BotHandling' && (
              <div className="flex gap-2 overflow-x-auto px-3 py-3 bg-white border-t border-gray-100">
                {["Bãi xe còn chỗ không?", "Bảng giá đỗ xe máy?", "Bảng giá đỗ ô tô?", "Có trạm sạc xe điện không?", "Mất vé xe phải làm sao?", "Tôi muốn gặp nhân sự"]
                  .filter(q => !messages.some(m => m.sender === 'User' && m.content.trim() === q))
                  .map((q, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setInputText(q)}
                    className="shrink-0 whitespace-nowrap px-3 py-1.5 text-xs font-medium text-[#FF4C4C] bg-[#FF4C4C]/10 rounded-full hover:bg-[#FF4C4C]/20 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={sendMessage} className={`p-3 bg-white border-gray-100 rounded-b-2xl flex items-center gap-2 ${status !== 'BotHandling' ? 'border-t' : ''}`}>
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                disabled={status === 'Escalated'}
                placeholder={status === 'Escalated' ? "Vui lòng đợi nhân viên..." : "Nhập tin nhắn..."}
                className="flex-1 text-sm bg-gray-50 border border-gray-100 rounded-full px-4 py-2.5 outline-none focus:border-[#FF4C4C] focus:bg-white transition-colors disabled:opacity-50 text-gray-900"
              />
              <button
                type="submit"
                disabled={!inputText.trim() || status === 'Escalated'}
                className="w-10 h-10 rounded-full bg-[#FF4C4C] text-white flex items-center justify-center hover:bg-red-600 transition-colors disabled:opacity-50 disabled:hover:bg-[#FF4C4C]"
              >
                <Send size={18} className="ml-1" />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
