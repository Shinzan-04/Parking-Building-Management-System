import React, { useState, useEffect, useRef } from 'react';
import * as signalR from '@microsoft/signalr';
import { MessageSquareWarning, Send, User, Bot, CheckCircle, Clock } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5237';

interface ChatSession {
  id: string;
  guestId: string;
  guestName: string;
  status: 'Escalated' | 'AgentHandling' | 'Closed';
  agentId: string | null;
  escalatedAt: string;
  createdAt: string;
}

interface ChatMessage {
  id: string;
  content: string;
  sender: 'User' | 'Bot' | 'Agent';
  createdAt: string;
}

export default function ChatDashboard() {
  const { user, token } = useAuth();
  const buildingId = user?.assignedBuildingId; // Get building from Staff

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [connection, setConnection] = useState<signalR.HubConnection | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load active sessions
  const fetchSessions = async () => {
    if (!buildingId) return;
    try {
      const res = await fetch(`${API_URL}/api/Chat/sessions?buildingId=${buildingId}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách chat:', err);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, [buildingId]);

  // Load messages when selecting a session
  useEffect(() => {
    if (!activeSessionId) return;
    
    const fetchMessages = async () => {
      try {
        const res = await fetch(`${API_URL}/api/Chat/${activeSessionId}/messages`);
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('Lỗi khi tải tin nhắn:', err);
      }
    };
    fetchMessages();
  }, [activeSessionId]);

  // Setup SignalR Global for Staff
  useEffect(() => {
    if (!buildingId) return;

    const newConnection = new signalR.HubConnectionBuilder()
      .withUrl(`${API_URL}/chatHub`, {
         accessTokenFactory: () => token || ''
      })
      .withAutomaticReconnect()
      .build();

    newConnection.on('NewEscalatedSession', (sessionId: string) => {
      console.log('Có phiên chat cần hỗ trợ:', sessionId);
      fetchSessions(); // Reload list
    });

    newConnection.on('SessionStatusChanged', (status: string, agentId: string) => {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId ? { ...s, status: status as any, agentId } : s
      ));
      fetchSessions(); // Refresh list to reflect changes
    });

    newConnection.on('ReceiveMessage', (id: string, sender: string, content: string, createdAt: string) => {
      setMessages(prev => [...prev, { id, sender: sender as any, content, createdAt }]);
    });

    newConnection.start()
      .then(() => {
        newConnection.invoke('JoinBuildingGroup', buildingId);
      })
      .catch(err => {
        if (err.name !== 'AbortError' && !err.message?.includes('negotiation')) {
          console.error('Lỗi kết nối SignalR:', err);
        }
      });

    setConnection(newConnection);

    return () => {
      newConnection.stop();
    };
  }, [buildingId]);

  // Join Active Session Channel when selecting
  useEffect(() => {
    if (connection && activeSessionId) {
       connection.invoke('JoinSession', activeSessionId);
    }
  }, [connection, activeSessionId]);

  const handleTakeover = async () => {
    if (!connection || !activeSessionId) return;
    try {
      await connection.invoke('TakeoverSession', activeSessionId);
    } catch (err) {
      console.error('Takeover failed', err);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !connection || !activeSessionId) return;

    try {
      await connection.invoke('SendMessage', activeSessionId, inputText, 'Agent');
      setInputText('');
    } catch (err) {
      console.error('Send failed', err);
    }
  };

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const isAgentHandling = activeSession?.status === 'AgentHandling';

  if (!buildingId) {
     return <div className="p-8 text-center text-red-500">Bạn chưa được phân công quản lý tòa nhà nào, không thể sử dụng Live Chat.</div>
  }

  return (
    <div className="h-[calc(100vh-9rem)] flex flex-col -mt-4">
      <div className="mb-4">
        <h1 className="text-2xl font-bold" style={{ color: 'var(--admin-text-primary)' }}>Live Chat Dashboard</h1>
        <p style={{ color: 'var(--admin-text-muted)' }}>Hỗ trợ trực tiếp khách hàng gặp sự cố tại bãi xe</p>
      </div>

      {/* Main Board */}
      <div className="flex-1 bg-white rounded-2xl border shadow-sm flex overflow-hidden" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-bg-card)' }}>
        {/* Left Sidebar: Session List */}
        <div className="w-1/3 flex flex-col border-r" style={{ borderColor: 'var(--admin-border)' }}>
          <div className="p-4 border-b" style={{ borderColor: 'var(--admin-border)' }}>
            <h2 className="font-bold">Danh sách yêu cầu</h2>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {sessions.length === 0 ? (
               <p className="text-center text-sm mt-10 opacity-50">Không có yêu cầu hỗ trợ nào</p>
            ) : (
              sessions.map(session => (
                <div 
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`p-3 rounded-xl cursor-pointer border transition-all ${activeSessionId === session.id ? 'border-[#FF4C4C]' : 'border-transparent hover:opacity-80'}`}
                  style={{ backgroundColor: activeSessionId === session.id ? 'var(--admin-bg-surface)' : 'transparent' }}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-semibold text-sm" style={{ color: 'var(--admin-text-primary)' }}>{session.guestName || 'Khách hàng ẩn danh'}</span>
                    <span className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>
                      {new Date(session.escalatedAt ?? session.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {session.status === 'Escalated' ? (
                      <span className="flex items-center gap-1 text-xs font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md">
                        <Clock size={12}/> Đang chờ...
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                        <CheckCircle size={12}/> Đang xử lý
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Area: Chat Window */}
        <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--admin-bg-surface)' }}>
          {!activeSessionId ? (
            <div className="flex-1 flex flex-col items-center justify-center opacity-50" style={{ color: 'var(--admin-text-muted)' }}>
              <MessageSquareWarning size={64} className="mb-4" />
              <p>Chọn một cuộc hội thoại bên trái để bắt đầu hỗ trợ</p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div className="h-16 border-b flex items-center justify-between px-6" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-bg-card)' }}>
                 <div>
                    <h3 className="font-bold" style={{ color: 'var(--admin-text-primary)' }}>Chat Session</h3>
                    <p className="text-xs" style={{ color: 'var(--admin-text-muted)' }}>ID: {activeSessionId}</p>
                 </div>
                 {activeSession?.status === 'Escalated' && (
                   <button 
                      onClick={handleTakeover}
                      className="bg-[#FF4C4C] hover:bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-all shadow-lg"
                   >
                     Tiếp quản ngay
                   </button>
                 )}
                 {isAgentHandling && (
                   <span className="text-emerald-500 font-medium text-sm flex items-center gap-1">
                     <CheckCircle size={16}/> Bạn đang phụ trách
                   </span>
                 )}
              </div>

              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {messages.map(msg => {
                  const displayContent = msg.content.replace('[SUGGEST_LIVECHAT]', '').trim();
                  if (!displayContent) return null;
                  
                  const isStaff = msg.sender === 'Agent';
                  const isBot = msg.sender === 'Bot';

                  return (
                    <div key={msg.id} className={`flex ${isStaff ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] p-3 rounded-2xl shadow-sm ${
                        isStaff ? 'bg-[#FF4C4C] text-white rounded-tr-sm' 
                        : isBot ? 'bg-indigo-100 text-indigo-900 rounded-tl-sm'
                        : 'border rounded-tl-sm'
                      }`}
                      style={!isStaff && !isBot ? { backgroundColor: 'var(--admin-bg-card)', borderColor: 'var(--admin-border)', color: 'var(--admin-text-primary)' } : {}}
                      >
                        {isBot && <p className="text-[10px] font-bold text-indigo-400 mb-1">AI TRỢ LÝ</p>}
                        {!isStaff && !isBot && <p className="text-[10px] font-bold mb-1" style={{ color: 'var(--admin-text-muted)' }}>KHÁCH HÀNG</p>}
                        <p className="text-sm whitespace-pre-wrap">{displayContent}</p>
                      </div>
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input */}
              <div className="p-4 border-t" style={{ borderColor: 'var(--admin-border)', backgroundColor: 'var(--admin-bg-card)' }}>
                <form onSubmit={handleSendMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={e => setInputText(e.target.value)}
                    disabled={!isAgentHandling}
                    placeholder={!isAgentHandling ? 'Bấm Tiếp quản để bắt đầu chat...' : 'Nhập tin nhắn hỗ trợ khách hàng...'}
                    className="flex-1 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#FF4C4C] disabled:opacity-50 text-sm transition-colors"
                    style={{ backgroundColor: 'var(--admin-bg-surface)', color: 'var(--admin-text-primary)', border: '1px solid var(--admin-border)' }}
                  />
                  <button
                    type="submit"
                    disabled={!inputText.trim() || !isAgentHandling}
                    className="w-12 rounded-xl flex items-center justify-center bg-[#FF4C4C] text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
