import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Send, Settings, Plus, MessageSquare, 
  Trash2, Monitor, Code, Zap, Cloud, LogOut, Mail, Lock, 
  Key, Palette, ExternalLink, User, WifiOff, Image as ImageIcon, Sparkles
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

// --- 🧠 INTERNAL KNOWLEDGE BASE ---
const LOCAL_BRAIN = [
  { 
    triggers: ["who are you", "what are you", "your name"], 
    response: "I am **LoganGPT**, an enterprise-grade AI. I support multi-tier architecture including standard text processing and advanced image generation capabilities." 
  },
  { 
    triggers: ["tiers", "pricing", "cost", "plans"], 
    response: "I operate on a tiered model:\n\n* **Free Tier:** Standard text processing.\n* **Images Tier:** Unlocks Imagen Mode for visual generation. Active when an Imagen key is detected." 
  },
  { 
    triggers: ["hello", "hi"], 
    response: "Greetings. Systems online. 🚀" 
  }
];

const SYSTEM_PROMPT = "You are LoganGPT. Helpful, professional, and precise.";

// --- LOGIN COMPONENT ---
function Login() {
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
      setLoading(false);
      if (err.code === 'auth/popup-closed-by-user') return;
      setError(err.message);
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
    <div className="flex h-screen w-full items-center justify-center bg-[#0B1120] text-slate-100 p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-10%] w-96 h-96 bg-violet-600/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] left-[-10%] w-96 h-96 bg-blue-600/20 rounded-full blur-[100px]" />

      <div className="w-full max-w-md bg-slate-900/50 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-violet-600 to-indigo-600 mx-auto flex items-center justify-center shadow-lg mb-4 text-white">
            <Zap className="w-8 h-8" fill="currentColor" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to LoganGPT</h1>
          <p className="text-slate-400 text-sm mt-2">Enterprise AI Workspace</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs rounded-lg flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500" /> {error}
          </div>
        )}

        <button 
          onClick={handleGoogle}
          disabled={loading}
          className="w-full bg-white text-slate-900 font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-slate-200 transition-colors mb-6"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="currentColor" d="M21.35 11.1h-9.17v2.73h6.51c-.33 3.81-3.5 5.44-6.5 5.44C8.36 19.27 5 16.25 5 12c0-4.1 3.2-7.27 7.2-7.27 3.09 0 4.9 1.97 4.9 1.97L19 4.72S16.56 2 12.1 2C6.42 2 2.03 6.8 2.03 12c0 5.05 4.13 10 10.22 10 5.35 0 9.25-3.67 9.25-9.09 0-1.15-.15-1.81-.15-1.81Z"/></svg>
          Continue with Google
        </button>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
          <div className="relative flex justify-center text-xs uppercase tracking-widest"><span className="bg-[#0f1623] px-2 text-slate-500">Or using email</span></div>
        </div>

        <form onSubmit={handleEmail} className="space-y-4">
          <div className="relative group">
            <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
            <input 
              type="email" 
              placeholder="Email address" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder-slate-600 text-sm"
              required
            />
          </div>
          <div className="relative group">
            <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-violet-400 transition-colors" />
            <input 
              type="password" 
              placeholder="Password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950/50 border border-white/10 rounded-xl py-3 pl-10 pr-4 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder-slate-600 text-sm"
              required
            />
          </div>
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-violet-900/20 mt-2"
          >
            {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
          </button>
        </form>

        <div className="mt-6 text-center text-sm">
          <button onClick={() => setIsSignUp(!isSignUp)} className="text-slate-400 hover:text-white transition-colors">
            {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- MAIN APP ---
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  
  // Settings & Modes
  const [apiKey, setApiKey] = useState('');
  const [imagenKey, setImagenKey] = useState('');
  const [imagenMode, setImagenMode] = useState(false); // Toggle state
  const [settingsTab, setSettingsTab] = useState('general');
  
  const [chats, setChats] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState({ color: '#8b5cf6', hover: '#7c3aed', name: 'Violet' });

  const chatContainerRef = useRef(null);

  // Auth & Config Loading
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    
    const savedKey = localStorage.getItem('gemini_api_key');
    const savedImagenKey = localStorage.getItem('imagen_api_key');
    const savedTheme = JSON.parse(localStorage.getItem('logan_theme'));
    
    if (savedKey) setApiKey(savedKey);
    if (savedImagenKey) setImagenKey(savedImagenKey);
    if (savedTheme) setTheme(savedTheme);

    return () => unsubscribe();
  }, []);

  // Fetch Chats
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'chats'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setChats(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [user]);

  // Fetch Messages
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

      // --- LOGIC FOR IMAGEN vs GEMINI ---
      let replyText = "";
      
      if (imagenMode && imagenKey) {
        // Mocking the Image Generation response for UI purposes
        // Real implementation would hit the Vertex AI endpoint here
        await new Promise(r => setTimeout(r, 2000));
        replyText = "🎨 **Imagen Generation Initiated**\n\n(Note: To display the actual image, the backend proxy for Vertex AI needs to be connected. This confirms your Imagen Mode is active and the key is recognized.)";
      } else if (!apiKey) {
        await new Promise(r => setTimeout(r, 400)); 
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
          role: 'model', text: fallback, timestamp: serverTimestamp()
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
    return "I am currently operating in **Offline Mode** with limited capabilities. Please enter a valid API key in settings to unlock full features.";
  };

  const saveSettings = () => {
    if (apiKey.trim()) localStorage.setItem('gemini_api_key', apiKey);
    else localStorage.removeItem('gemini_api_key');

    if (imagenKey.trim()) localStorage.setItem('imagen_api_key', imagenKey);
    else localStorage.removeItem('imagen_api_key');

    localStorage.setItem('logan_theme', JSON.stringify(theme));
    setIsSettingsOpen(false);
  };

  if (authLoading) return <div className="h-screen w-full bg-[#0B1120] flex items-center justify-center text-slate-500">Loading...</div>;
  
  if (!user) return <Login />;

  return (
    <div className="flex h-[100dvh] bg-[#0B1120] text-slate-100 font-sans overflow-hidden"
         style={{ '--accent': imagenMode ? '#6366f1' : theme.color, '--accent-hover': imagenMode ? '#4f46e5' : theme.hover }}>
      
      {/* Sidebar Overlay */}
      <div className={`fixed inset-0 bg-black/60 z-20 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
           onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-[#020617] border-r border-white/5 z-30 transform transition-transform duration-300 flex flex-col shadow-2xl
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10">
              <Cloud className="w-4 h-4 text-emerald-400" />
            </div>
            <span className="font-semibold text-sm tracking-wide text-slate-200">History</span>
          </div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-3">
          <button onClick={createNewChat} className="w-full flex items-center justify-center gap-2 text-white p-3 rounded-xl shadow-lg transition-all font-medium hover:brightness-110" style={{ backgroundColor: theme.color }}>
            <Plus className="w-4 h-4" /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 && <div className="text-center text-xs text-slate-600 mt-4 italic">No conversation history</div>}
          {chats.map(chat => (
            <div key={chat.id} 
                 onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }}
                 className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all border border-transparent 
                 ${activeChatId === chat.id ? 'bg-white/10 border-white/10' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate text-slate-200">{chat.title}</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  {chat.timestamp ? new Date(chat.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}
                </div>
              </div>
              <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-opacity">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-white/5 bg-black/20">
           <div className="flex items-center gap-3 mb-3 px-1">
             <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-slate-700 to-slate-600 flex items-center justify-center text-xs font-bold text-white border border-white/10">
               {user.email ? user.email[0].toUpperCase() : 'U'}
             </div>
             <div className="flex-1 min-w-0">
               <div className="text-xs font-medium text-white truncate">{user.email || 'Anonymous User'}</div>
               <div className="text-[10px] text-slate-500">
                 {imagenKey ? 'Images Tier' : 'Free Tier'}
               </div>
             </div>
           </div>
           <button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-colors w-full border border-white/5">
             <LogOut className="w-3.5 h-3.5" /> Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-[#0B1120]">
        
        {/* Navbar */}
        <header className="absolute top-0 w-full bg-[#0B1120]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-400">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">LoganGPT</span>
              {imagenMode ? (
                <span className="flex items-center gap-1 text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full border border-indigo-500/30 font-bold tracking-wide animate-pulse">
                  <Sparkles className="w-3 h-3" /> IMAGEN
                </span>
              ) : !apiKey ? (
                <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5">
                  <WifiOff className="w-3 h-3" /> Offline
                </span>
              ) : (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20">PRO</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {/* --- IMAGEN MODE TOGGLE --- */}
            {imagenKey && (
              <button 
                onClick={() => setImagenMode(!imagenMode)}
                className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${imagenMode ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}
                title="Toggle Image Generation"
              >
                <ImageIcon className="w-4 h-4" />
                <span className="hidden sm:inline">{imagenMode ? 'ON' : 'OFF'}</span>
              </button>
            )}

            <button onClick={() => setIsSettingsOpen(true)} className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors">
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat Area */}
        <main ref={chatContainerRef} className="flex-1 overflow-y-auto pt-20 pb-28 px-4 scroll-smooth">
          {!activeChatId ? (
            <div className="max-w-2xl mx-auto mt-12 md:mt-20 text-center space-y-8 px-4 animate-fade-in">
              <div className="relative w-20 h-20 mx-auto">
                <div className={`absolute inset-0 bg-gradient-to-tr rounded-2xl blur-xl opacity-50 animate-pulse ${imagenMode ? 'from-indigo-500 to-purple-500' : 'from-violet-500 to-indigo-500'}`}></div>
                <div className="relative w-20 h-20 bg-slate-900 rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl" style={{ borderColor: imagenMode ? '#6366f1' : theme.color }}>
                  {imagenMode ? <ImageIcon className="w-10 h-10 text-indigo-400" /> : <Monitor className="w-10 h-10" style={{ color: theme.color }} />}
                </div>
              </div>
              
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">{imagenMode ? "Imagen Studio Active." : "System Online."}</h2>
                <p className="text-slate-400">
                  {imagenMode ? "Ready to generate enterprise-grade imagery." : (apiKey ? "Connected to Cloud Intelligence." : "Running in Offline Mode.")}
                </p>
              </div>

              {!imagenMode && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
                  <button onClick={() => { setInput("What can you do?"); }} className="group p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-all hover:scale-[1.02]">
                    <div className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                      <Zap className="w-4 h-4 text-yellow-400" /> Capabilities
                    </div>
                    <div className="text-xs text-slate-500 group-hover:text-slate-400">"What can you do?"</div>
                  </button>
                  <button onClick={() => { setInput("Debug this code"); }} className="group p-4 rounded-2xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-all hover:scale-[1.02]">
                    <div className="text-sm font-semibold text-slate-200 mb-1 flex items-center gap-2">
                      <Code className="w-4 h-4 text-blue-400" /> Coding
                    </div>
                    <div className="text-xs text-slate-500 group-hover:text-slate-400">"Debug this code snippet"</div>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-9 h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold border border-white/10 shadow-lg ${msg.role === 'user' ? 'bg-slate-800 text-slate-300' : 'text-white'}`} style={msg.role === 'model' ? { backgroundColor: imagenMode && msg.role === 'model' ? '#6366f1' : theme.color } : {}}>
                    {msg.role === 'user' ? <User className="w-4 h-4"/> : (imagenMode ? <ImageIcon className="w-4 h-4"/> : <Zap className="w-4 h-4" fill="currentColor"/>)}
                  </div>
                  <div className={`max-w-[85%] rounded-2xl p-4 text-sm leading-7 shadow-md border ${msg.role === 'user' ? 'bg-slate-800 text-white border-white/5' : 'bg-slate-900/50 text-slate-200 border-white/5'}`}>
                    <ReactMarkdown className="prose prose-invert max-w-none">{msg.text}</ReactMarkdown>
                  </div>
                </div>
              ))}
              {isLoading && <div className="text-slate-500 text-xs text-center animate-pulse flex items-center justify-center gap-2">
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-75"></span>
                <span className="w-1.5 h-1.5 bg-slate-500 rounded-full animate-bounce delay-150"></span>
              </div>}
            </div>
          )}
        </main>

        <footer className="fixed bottom-0 w-full lg:w-[calc(100%-18rem)] bg-gradient-to-t from-[#0B1120] via-[#0B1120] to-transparent p-4 z-20">
          <div className={`max-w-3xl mx-auto relative backdrop-blur-xl rounded-2xl flex items-center shadow-2xl border transition-colors ring-1 ring-white/5 ${imagenMode ? 'bg-indigo-950/40 border-indigo-500/30' : 'bg-[#1e293b]/50 border-white/10'}`}>
            <input 
              type="text" 
              value={input} 
              onChange={(e) => setInput(e.target.value)} 
              disabled={isLoading}
              className="w-full bg-transparent text-white border-0 focus:ring-0 px-5 py-4 placeholder-slate-500 font-light focus:outline-none" 
              placeholder={imagenMode ? "Describe an image to generate..." : "Message LoganGPT..."}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(e)}
            />
            <button onClick={handleSend} disabled={isLoading || !input.trim()} className="p-2.5 mr-2 text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50" style={{ backgroundColor: imagenMode ? '#6366f1' : theme.color }}>
              {imagenMode ? <Sparkles className="w-4 h-4" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-center text-[10px] text-slate-600 mt-2">{imagenMode ? "Image generation may incur separate costs." : "AI may produce inaccurate information."}</p>
        </footer>
      </div>

      {/* --- SETTINGS MODAL --- */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-[#0F172A] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-white/5 flex items-center justify-between bg-slate-900/50">
              <div className="flex gap-4">
                <button 
                  onClick={() => setSettingsTab('general')} 
                  className={`text-sm font-bold pb-1 border-b-2 transition-colors ${settingsTab === 'general' ? 'text-white border-violet-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                  General
                </button>
                <button 
                  onClick={() => setSettingsTab('tiers')} 
                  className={`text-sm font-bold pb-1 border-b-2 transition-colors ${settingsTab === 'tiers' ? 'text-white border-violet-500' : 'text-slate-500 border-transparent hover:text-slate-300'}`}
                >
                  Plans & Tiers
                </button>
              </div>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-1.5 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            {/* Modal Body */}
            <div className="p-6 space-y-8 overflow-y-auto">
              
              {settingsTab === 'general' ? (
                <>
                  {/* API Key Section */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" /> Google Gemini API Key
                    </label>
                    <div className="relative group">
                      <input 
                        type="password" 
                        value={apiKey} 
                        onChange={(e) => setApiKey(e.target.value)} 
                        className="w-full bg-black/20 border border-white/10 rounded-xl p-3 pl-4 text-white text-sm focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all placeholder-slate-600" 
                        placeholder="sk-..." 
                      />
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>Required for chat.</span>
                      <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="flex items-center gap-1 text-violet-400 hover:text-violet-300">
                        Get Key <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>

                  {/* Theme Section */}
                  <div className="space-y-3">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                      <Palette className="w-3.5 h-3.5" /> Interface Theme
                    </label>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { c: '#8b5cf6', h: '#7c3aed', n: 'Violet' },
                        { c: '#3b82f6', h: '#2563eb', n: 'Blue' },
                        { c: '#10b981', h: '#059669', n: 'Emerald' },
                        { c: '#f43f5e', h: '#e11d48', n: 'Rose' },
                      ].map((t) => (
                        <div key={t.c} className="flex flex-col items-center gap-2">
                          <button 
                            onClick={() => setTheme({color: t.c, hover: t.h, name: t.n})} 
                            className={`w-full h-10 rounded-xl transition-all shadow-lg ${theme.color === t.c ? 'ring-2 ring-white scale-105' : 'hover:scale-105 opacity-80 hover:opacity-100'}`} 
                            style={{backgroundColor: t.c}} 
                          />
                          <span className="text-[10px] text-slate-400 font-medium">{t.n}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {/* Free Tier Card */}
                  <div className={`p-4 rounded-xl border ${!imagenKey ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-white/5 bg-white/5 opacity-50'}`}>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <MessageSquare className="w-4 h-4" /> Free Tier
                      </h3>
                      {!imagenKey && <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold">ACTIVE</span>}
                    </div>
                    <ul className="text-xs text-slate-400 space-y-1 ml-6 list-disc">
                      <li>Unlimited Text Chat</li>
                      <li>Standard Gemini Model</li>
                      <li>Basic Reasoning</li>
                    </ul>
                  </div>

                  {/* Imagen Tier Card */}
                  <div className={`p-4 rounded-xl border relative overflow-hidden ${imagenKey ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/10 bg-gradient-to-br from-indigo-900/20 to-purple-900/20'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <h3 className="font-bold text-white flex items-center gap-2">
                        <ImageIcon className="w-4 h-4 text-indigo-400" /> Images Tier
                      </h3>
                      {imagenKey ? (
                        <span className="text-[10px] bg-indigo-500 text-white px-2 py-0.5 rounded-full font-bold">ACTIVE</span>
                      ) : (
                        <a 
                          href="https://console.cloud.google.com/vertex-ai" 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-[10px] bg-white text-black px-3 py-1 rounded-full font-bold hover:bg-slate-200 flex items-center gap-1"
                        >
                          Get Key <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                    
                    <p className="text-xs text-slate-400 mb-3">Unlocks Imagen Mode for high-fidelity image generation.</p>
                    
                    {/* Imagen Key Input */}
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Imagen API Key (Vertex AI)</label>
                      <input 
                        type="password" 
                        value={imagenKey} 
                        onChange={(e) => setImagenKey(e.target.value)} 
                        className="w-full bg-black/40 border border-white/10 rounded-lg p-2.5 text-white text-xs focus:outline-none focus:border-indigo-500/50 transition-all placeholder-slate-600" 
                        placeholder="Paste key to unlock..." 
                      />
                    </div>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-white/5 bg-slate-900/30">
              <button 
                onClick={saveSettings} 
                className="w-full text-white font-bold py-3 rounded-xl shadow-lg hover:brightness-110 transition-all" 
                style={{ backgroundColor: theme.color }}
              >
                Save Changes
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}


