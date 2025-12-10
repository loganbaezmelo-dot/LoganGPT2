import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Send, Settings, Plus, MessageSquare, 
  Trash2, Monitor, Code, Zap, Cloud, LogOut, Mail, Lock 
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Firebase Imports
import { db, auth } from './firebase';
import { 
  collection, addDoc, query, orderBy, onSnapshot, 
  deleteDoc, doc, updateDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';

// Internal Knowledge
const LOCAL_BRAIN = [
  { triggers: ["who are you", "what are you"], response: "I am **LoganGPT**, authenticated and cloud-synced. ☁️" },
  { triggers: ["are you google", "are you gemini"], response: "I am a custom React app. Google is just my backend API. 💅" },
  { triggers: ["hello", "hi"], response: "Yo. Systems online. 🚀" }
];

const SYSTEM_PROMPT = "You are LoganGPT. Helpful, witty, and concise. You are NOT Google Gemini.";

// --- LOGIN COMPONENT ---
function Login({ onLogin }) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogle = async () => {
    try {
      setLoading(true);
      setError('');
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmail = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-100 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-violet-500 mx-auto flex items-center justify-center shadow-lg mb-4 text-white">
            <Zap className="w-8 h-8" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to LoganGPT</h1>
          <p className="text-slate-400 text-sm mt-2">Enterprise AI Workspace</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg">
            {error}
          </div>
        )}

        <button 
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-white text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-100 transition-colors mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"/></svg>
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-slate-900 px-2 text-slate-500">Or continue with email</span></div>
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder-slate-600"
              required
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:ring-1 focus:ring-violet-500 transition-all placeholder-slate-600"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-violet-600 hover:bg-violet-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-violet-900/20"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <span className="text-slate-400">{isSignUp ? "Already have an account?" : "Don't have an account?"}</span>
          <button onClick={() => setIsSignUp(!isSignUp)} className="ml-2 text-violet-400 hover:text-violet-300 font-medium">
            {isSignUp ? "Sign In" : "Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // App State
  const [apiKey, setApiKey] = useState('');
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState({ color: '#8b5cf6', hover: '#7c3aed' });

  const chatContainerRef = useRef(null);

  // 1. Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Load Config
  useEffect(() => {
    const savedKey = localStorage.getItem('gemini_api_key');
    const savedTheme = JSON.parse(localStorage.getItem('logan_theme'));
    if (savedKey) setApiKey(savedKey);
    if (savedTheme) setTheme(savedTheme);
  }, []);

  // 3. Fetch Data
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'chats'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([]);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'chats', activeChatId, 'messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => doc.data()));
    });
    return () => unsubscribe();
  }, [user, activeChatId]);

  // Auto Scroll
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, activeChatId, isLoading]);

  // Actions
  const handleLogout = async () => {
    await signOut(auth);
    setChats([]);
    setMessages([]);
    setActiveChatId(null);
  };

  const createNewChat = () => {
    setActiveChatId(null);
    setInput('');
    setIsSidebarOpen(false);
  };

  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'chats', chatId));
    if (activeChatId === chatId) setActiveChatId(null);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || !user) return;

    const userText = input.trim();
    setInput('');
    setIsLoading(true);

    let currentChatId = activeChatId;

    try {
      if (!currentChatId) {
        const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
          title: userText,
          timestamp: serverTimestamp()
        });
        currentChatId = chatRef.id;
        setActiveChatId(currentChatId);
      } else {
        await updateDoc(doc(db, 'users', user.uid, 'chats', currentChatId), {
          timestamp: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'), {
        role: 'user', text: userText, timestamp: serverTimestamp()
      });

      let replyText = "";
      if (!apiKey) {
        await new Promise(r => setTimeout(r, 600));
        replyText = queryLocalBrain(userText);
      } else {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: userText }] }],
            systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
          })
        });
        if (!response.ok) throw new Error("API_FAIL");
        const data = await response.json();
        replyText = data.candidates[0].content.parts[0].text;
      }

      await addDoc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'), {
        role: 'model', text: replyText, timestamp: serverTimestamp()
      });

    } catch (err) {
      const fallback = queryLocalBrain(userText);
      if (currentChatId) {
        await addDoc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'), {
          role: 'model', text: fallback + " (Fallback)", timestamp: serverTimestamp()
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const queryLocalBrain = (text) => {
    const lowerInput = text.toLowerCase();
    for (const entry of LOCAL_BRAIN) {
      if (entry.triggers.some(t => lowerInput.includes(t))) return entry.response;
    }
    return "I'm offline or keyless. 💀";
  };

  const saveSettings = (newKey, newTheme) => {
    if (newKey.trim()) {
      setApiKey(newKey);
      localStorage.setItem('gemini_api_key', newKey);
    } else {
      setApiKey('');
      localStorage.removeItem('gemini_api_key');
    }
    setTheme(newTheme);
    localStorage.setItem('logan_theme', JSON.stringify(newTheme));
    setIsSettingsOpen(false);
  };

  // --- RENDER FLOW ---
  if (authLoading) return <div className="h-screen w-full bg-slate-950 flex items-center justify-center text-slate-500">Loading...</div>;
  
  if (!user) return <Login />;

  return (
    <div className="flex h-[100dvh] bg-slate-950 text-slate-100 font-sans overflow-hidden"
         style={{ '--accent': theme.color, '--accent-hover': theme.hover }}>
      
      {/* Sidebar Overlay */}
      <div className={`fixed inset-0 bg-black/50 z-20 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
           onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-slate-900 border-r border-white/5 z-30 transform transition-transform duration-300 flex flex-col shadow-2xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <h2 className="font-semibold text-slate-300 tracking-wide flex items-center gap-2">
            <Cloud className="w-4 h-4 text-emerald-400" /> Cloud History
          </h2>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <button onClick={createNewChat} className="w-full flex items-center gap-2 text-white p-3 rounded-xl shadow-lg transition-all font-medium hover:opacity-90" style={{ backgroundColor: theme.color }}>
            <Plus className="w-5 h-5" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 && <div className="text-center text-xs text-slate-600 mt-4">No cloud history</div>}
          {chats.map(chat => (
            <div key={chat.id} 
                 onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }}
                 className={`group relative flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:bg-white/5 transition-colors border border-transparent 
                 ${activeChatId === chat.id ? 'bg-white/10 border-white/10' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-slate-200">{chat.title}</div>
                <div className="text-[10px] text-slate-500">
                  {chat.timestamp ? new Date(chat.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                </div>
              </div>
              <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5">
           <button onClick={handleLogout} className="flex items-center gap-2 text-xs text-slate-400 hover:text-white transition-colors w-full">
             <LogOut className="w-4 h-4" /> Sign Out ({user.email || 'User'})
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-slate-950">
        <header className="absolute top-0 w-full bg-slate-950/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-400">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="font-semibold text-sm tracking-wide text-slate-200">LoganGPT <span className="opacity-50 font-light">Cloud</span></h1>
          </div>
          <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg">
            <Settings className="w-5 h-5" />
          </button>
        </header>

        <main ref={chatContainerRef} className="flex-1 overflow-y-auto pt-20 pb-28 px-4 scroll-smooth">
          {!activeChatId ? (
            <div className="max-w-2xl mx-auto mt-16 text-center space-y-6 px-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-2xl mb-4 text-white" style={{ backgroundColor: theme.color }}>
                <Monitor className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-semibold text-white">System Ready.</h2>
              <p className="text-slate-400">Your chats are now synced to Firebase. ☁️</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold border border-white/10 shadow-lg ${msg.role === 'user' ? 'bg-slate-800 text-slate-300' : 'text-white'}`} style={msg.role === 'model' ? { backgroundColor: theme.color } : {}}>
                    {msg.role === 'user' ? 'U' : 'L'}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-relaxed shadow-md ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'text-slate-200'}`}>
                    <ReactMarkdown className="prose prose-invert max-w-none">{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && <div className="text-slate-500 text-xs text-center animate-pulse">Thinking...</div>}
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 w-full lg:w-[calc(100%-18rem)] bg-gradient-to-t from-slate-950 via-slate-950 to-transparent p-4 z-20">
          <div className="max-w-3xl mx-auto relative bg-slate-900 rounded-2xl flex items-center shadow-2xl border border-white/5">
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              disabled={isLoading}
              className="w-full bg-transparent text-white border-0 focus:ring-0 px-4 py-4 placeholder-slate-500 font-light" 
              placeholder="Message LoganGPT..." 
              onKeyDown={(e) => e.key === 'Enter' && handleSend(e)}
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-2 mr-2 text-white rounded-xl hover:opacity-90" style={{ backgroundColor: theme.color }}>
              <Send className="w-5 h-5" />
            </button>
          </div>
        </footer>
      </div>

      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-6">
            <h2 className="text-lg font-semibold text-white">Settings</h2>
            <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="w-full bg-slate-950 border border-white/10 rounded-lg p-3 text-white" placeholder="API Key..." />
            
            <div className="grid grid-cols-4 gap-3">
               {['#8b5cf6', '#3b82f6', '#10b981', '#f43f5e'].map(c => (
                 <button key={c} onClick={() => setTheme({color: c, hover: c})} className="h-8 rounded-full" style={{backgroundColor: c}} />
               ))}
            </div>

            <button onClick={() => saveSettings(apiKey, theme)} className="w-full text-white font-medium py-3 rounded-xl shadow-lg" style={{ backgroundColor: theme.color }}>Save</button>
            <button onClick={() => setIsSettingsOpen(false)} className="w-full text-slate-400 text-sm mt-2">Close</button>
          </div>
        </div>
      )}
    </div>
  );
}


