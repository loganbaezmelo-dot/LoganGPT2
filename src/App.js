import React, { useState, useEffect, useRef } from 'react';
import { 
  Menu, X, Send, Settings, Plus, 
  Trash2, Monitor, Zap, Cloud, LogOut, Mail, Lock, 
  Key, User, WifiOff, Image as ImageIcon, ExternalLink,
  Paintbrush, Layout, Play, Bot, ToggleLeft, ToggleRight,
  Copy, Check, Globe, Sparkles, Mic, MicOff, Paperclip, FileText
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';

// Firebase Imports
import { db, auth } from './firebase';
import { 
  collection, addDoc, query, onSnapshot, 
  deleteDoc, doc, updateDoc, setDoc, serverTimestamp 
} from 'firebase/firestore';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut 
} from 'firebase/auth';

// --- INTERNAL KNOWLEDGE BASE ---
const LOCAL_BRAIN = [
  { 
    triggers: ["who are you", "what are you", "your name"], 
    response: "I am **LoganGPT**, an enterprise workspace supporting multi-provider AI routing including OpenAI and Google Gemini." 
  },
  { 
    triggers: ["tiers", "pricing", "cost", "plans"], 
    response: "I operate on a tiered model:\n\n* **Standard Tier:** Advanced reasoning text processing.\n* **Creative Tier:** Unlocks image generation (Included).\n* **Canvas Tier:** Enables live code prototyping." 
  },
  { 
    triggers: ["hello", "hi"], 
    response: "Greetings. Systems online." 
  }
];

// Dynamic DuckDuckGo Instant Answer Search Helper (Free & Keyless)
const fetchDuckDuckGoSearch = async (queryText) => {
  try {
    const res = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(queryText)}&format=json&no_html=1&skip_disambig=1`);
    const data = await res.json();

    if (data.AbstractText) {
      return `🦆 **DuckDuckGo Web Result** (${data.AbstractSource}):\n\n${data.AbstractText}\n\n[Read source on DuckDuckGo](${data.AbstractURL})`;
    } else if (data.RelatedTopics && data.RelatedTopics.length > 0) {
      const topic = data.RelatedTopics.find(t => t.Text && t.FirstURL);
      if (topic) {
        return `🦆 **DuckDuckGo Search Info**:\n\n${topic.Text}\n\n[Read more](${topic.FirstURL})`;
      }
    }
    return null;
  } catch (err) {
    console.error("DuckDuckGo Fetch Error:", err);
    return null;
  }
};

const SYSTEM_PROMPT_STANDARD = `You are LoganGPT, an enterprise AI workspace. Format responses clearly using valid Markdown and LaTeX when appropriate.

STRICT FORMATTING & CAPABILITIES INSTRUCTIONS:
1. ARROWS & SYMBOLS: Prefer standard Unicode arrows (->, ←, →, ↔, ⇒) for simple text chains or process flows. Use LaTeX inline math tags (e.g. $\\rightarrow$, $x^2 + y^2 = z^2$) ONLY for formal math or science equations.
2. TABLES & LISTS: Feel free to use standard Markdown tables and bulleted lists. They will be rendered cleanly in scrollable containers.
3. CODE BLOCKS: Always format code snippets using triple backticks with the language specified (e.g., \`\`\`js or \`\`\`html).
4. IMAGE GENERATION: You CAN generate images! If asked to create, draw, or make an image, inform the user they can toggle Creative Mode or output images inline directly using Markdown format: \`![description](https://image.pollinations.ai/prompt/URL_ENCODED_PROMPT?width=800&height=600&nologo=true)\`.`;

const SYSTEM_PROMPT_CANVAS = "You are LoganGPT Canvas. Your goal is to build functional web applications based on user requests. OUTPUT RULES: 1. Provide a SINGLE, SELF-CONTAINED HTML file inside a markdown code block (```html ... ```). 2. Include all CSS (in <style>) and JS (in <script>) within that file. 3. Make the design modern, clean, and responsive. 4. Do not explain the code excessively, just build it. 5. If the user asks for a game or tool, make it playable/usable immediately.";

// --- RETRY FETCH HELPER ---
const fetchWithRetry = async (url, options, retries = 2, backoff = 500) => {
  try {
    const response = await fetch(url, options);
    const rawText = await response.text();

    let parsedData = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = { error: rawText };
    }

    if (!response.ok) {
      const errDetail = parsedData.error || `HTTP ${response.status} ${response.statusText}`;
      throw new Error(typeof errDetail === 'string' ? errDetail : JSON.stringify(errDetail, null, 2));
    }

    return parsedData;
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, backoff));
    return fetchWithRetry(url, options, retries - 1, backoff * 1.5);
  }
};

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
  const [provider, setProvider] = useState(() => localStorage.getItem('ai_provider') || 'openai');
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [googleKey, setGoogleKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [timeZone, setTimeZone] = useState(() => localStorage.getItem('user_timezone') || 'America/New_York');
  
  const [currentMode, setCurrentMode] = useState('standard'); 
  const [selectedAI, setSelectedAI] = useState(null); 
  const [isCreatorOpen, setIsCreatorOpen] = useState(false);
  
  // Data
  const [chats, setChats] = useState([]);
  const [customAIs, setCustomAIs] = useState([]);
  const [messages, setMessages] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  
  // Input, Voice, Image & Attachment State
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [attachedFile, setAttachedFile] = useState(null);
  const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [theme, setTheme] = useState({ color: '#8b5cf6', hover: '#7c3aed', name: 'Violet' });

  // Creator State
  const [newAIName, setNewAIName] = useState('');
  const [newAIPersonality, setNewAIPersonality] = useState('');
  const [newAIRoleplay, setNewAIRoleplay] = useState(false);
  const [newAIAccuracy, setNewAIAccuracy] = useState(true);

  // Canvas State
  const [canvasCode, setCanvasCode] = useState(null);
  const [isCanvasPreviewOpen, setIsCanvasPreviewOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const chatContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const imageInputRef = useRef(null);
  const fileInputRef = useRef(null);

  const activeKey = provider === 'google' ? googleKey : openaiKey;

  // Auth & Settings Load
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });

    const savedTheme = JSON.parse(localStorage.getItem('logan_theme'));
    if (savedTheme) setTheme(savedTheme);

    return () => unsubscribe();
  }, []);

  // Sync Settings from Firestore
  useEffect(() => {
    if (!user) return;
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'config');
    const unsubscribe = onSnapshot(settingsDocRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.provider) {
          setProvider(data.provider);
          localStorage.setItem('ai_provider', data.provider);
        }
        if (data.openaiKey !== undefined) {
          setOpenaiKey(data.openaiKey);
          if (data.openaiKey) localStorage.setItem('openai_api_key', data.openaiKey);
        }
        if (data.googleKey !== undefined) {
          setGoogleKey(data.googleKey);
          if (data.googleKey) localStorage.setItem('gemini_api_key', data.googleKey);
        }
        if (data.timeZone) {
          setTimeZone(data.timeZone);
          localStorage.setItem('user_timezone', data.timeZone);
        }
        if (data.theme) {
          setTheme(data.theme);
          localStorage.setItem('logan_theme', JSON.stringify(data.theme));
        }
      }
    }, (err) => console.error("Settings Listener Error:", err));

    return () => unsubscribe();
  }, [user]);

  // Fetch Chats
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'chats'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      loadedChats.sort((a, b) => (b.timestamp?.seconds || Date.now() / 1000) - (a.timestamp?.seconds || Date.now() / 1000));
      setChats(loadedChats);
    }, (err) => console.error("Chats Listener Error:", err));
    return () => unsubscribe();
  }, [user]);

  // Fetch Custom AIs
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'custom_ais'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCustomAIs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => console.error("Custom AIs Listener Error:", err));
    return () => unsubscribe();
  }, [user]);

  // Synchronize persona state when opening a chat from history
  useEffect(() => {
    if (!activeChatId || chats.length === 0) return;
    const activeChat = chats.find(c => c.id === activeChatId);
    if (activeChat && activeChat.aiId && activeChat.aiId !== 'logan-default') {
      const matchingAI = customAIs.find(ai => ai.id === activeChat.aiId);
      if (matchingAI) {
        setSelectedAI(matchingAI);
        setCurrentMode('standard');
      }
    } else if (activeChat && (!activeChat.aiId || activeChat.aiId === 'logan-default')) {
      setSelectedAI(null);
    }
  }, [activeChatId, chats, customAIs]);

  // Fetch Messages with stable tie-breaker sorting
  useEffect(() => {
    if (!user || !activeChatId) {
      setMessages([]);
      setCanvasCode(null);
      return;
    }
    const q = query(collection(db, 'users', user.uid, 'chats', activeChatId, 'messages'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      const now = Date.now() / 1000;

      msgs.sort((a, b) => {
        const timeA = a.timestamp?.seconds || now;
        const timeB = b.timestamp?.seconds || now;

        if (timeA !== timeB) {
          return timeA - timeB;
        }

        if (a.role === 'user' && b.role !== 'user') return -1;
        if (a.role !== 'user' && b.role === 'user') return 1;

        return 0;
      });

      if (msgs.length > 0) {
        setMessages(msgs);
        const lastMsg = msgs[msgs.length - 1];
        if (lastMsg && (lastMsg.role === 'assistant' || lastMsg.role === 'model')) {
          setIsLoading(false);
        }
      }

      const lastCanvasMsg = [...msgs].reverse().find(m => (m.role === 'assistant' || m.role === 'model') && m.text && m.text.includes('```html'));
      if (lastCanvasMsg) {
        const match = lastCanvasMsg.text.match(/```html([\s\S]*?)```/);
        if (match && match[1]) {
          setCanvasCode(match[1]);
        }
      }
    }, (err) => console.error("Messages Listener Error:", err));

    return () => unsubscribe();
  }, [user, activeChatId]);

  // Auto Scroll Anchor Fix
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChatId, isLoading]);

  // Speech Recognition Toggle
  const toggleVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please try Chrome or Edge.");
      return;
    }

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
      setInput(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Image Upload Handling
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.');
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      alert('Image size should be less than 4MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setSelectedImage(event.target.result);
      setAttachedFile(null);
    };
    reader.readAsDataURL(file);
    setIsAttachMenuOpen(false);
    e.target.value = '';
  };

  // Document / Code File Upload Handling
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size should be less than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachedFile({
        name: file.name,
        content: event.target.result
      });
      setSelectedImage(null);
    };
    reader.readAsText(file);
    setIsAttachMenuOpen(false);
    e.target.value = '';
  };

  // Actions
  const handleLogout = async () => {
    await signOut(auth);
    setChats([]);
    setCustomAIs([]);
    setMessages([]);
    setActiveChatId(null);
  };

  const createNewChat = (ai = null) => {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setSelectedImage(null);
    setAttachedFile(null);
    setCanvasCode(null);
    setIsSidebarOpen(false);
    setSelectedAI(ai);
    if (ai) setCurrentMode('standard'); 
  };

  const createCustomAI = async () => {
    if (!newAIName.trim() || !newAIPersonality.trim()) return;
    
    await addDoc(collection(db, 'users', user.uid, 'custom_ais'), {
      name: newAIName,
      personality: newAIPersonality,
      isRoleplay: newAIRoleplay,
      accuracy: newAIRoleplay ? false : newAIAccuracy, 
      timestamp: serverTimestamp()
    });
    
    setNewAIName('');
    setNewAIPersonality('');
    setNewAIRoleplay(false);
    setNewAIAccuracy(true);
    setIsCreatorOpen(false);
  };

  const deleteChat = async (e, chatId) => {
    e.stopPropagation();
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'chats', chatId));
    if (activeChatId === chatId) {
      setActiveChatId(null);
      setMessages([]);
      setSelectedAI(null);
    }
  };

  const deleteCustomAI = async (e, aiId) => {
    e.stopPropagation();
    if (!user) return;
    await deleteDoc(doc(db, 'users', user.uid, 'custom_ais', aiId));
    if (selectedAI?.id === aiId) setSelectedAI(null);
  };

  const toggleMode = (mode) => {
    setCurrentMode(currentMode === mode ? 'standard' : mode);
    if (mode === 'creative') {
      setSelectedImage(null);
      setAttachedFile(null);
    }
    if (mode !== 'standard') setSelectedAI(null); 
  };

  const queryLocalBrain = async (text) => {
    const lowerInput = text.toLowerCase();
    for (const entry of LOCAL_BRAIN) {
      if (entry.triggers.some(t => lowerInput.includes(t))) return entry.response;
    }

    const searchResult = await fetchDuckDuckGoSearch(text);
    if (searchResult) return searchResult;

    return `I am currently operating in **Offline Mode**. Please enter a valid ${provider === 'google' ? 'Google Gemini' : 'OpenAI'} API key in Settings to unlock dynamic reasoning.`;
  };

  const sendQueryDirectly = (promptText) => {
    setInput(promptText);
    setTimeout(() => {
      handleSendWithText(promptText, null, null);
    }, 50);
  };

  const handleSendWithText = async (textToSend, imageToSend, fileToSend) => {
    if ((!textToSend.trim() && !imageToSend && !fileToSend) || !user || isLoading) return;

    setInput('');
    const imagePayload = imageToSend || selectedImage;
    const filePayload = fileToSend || attachedFile;
    setSelectedImage(null);
    setAttachedFile(null);
    setIsLoading(true);

    let effectiveTimeZone = timeZone;

    const tzMatches = {
      'est': 'America/New_York', 'edt': 'America/New_York', 'eastern': 'America/New_York', 'ny': 'America/New_York', 'new york': 'America/New_York',
      'cst': 'America/Chicago', 'cdt': 'America/Chicago', 'central': 'America/Chicago',
      'mst': 'America/Denver', 'mdt': 'America/Denver', 'mountain': 'America/Denver',
      'pst': 'America/Los_Angeles', 'pdt': 'America/Los_Angeles', 'pacific': 'America/Los_Angeles',
      'gmt': 'Europe/London', 'bst': 'Europe/London', 'london': 'Europe/London'
    };
    
    const lowerText = textToSend.toLowerCase();
    for (const [keyword, tz] of Object.entries(tzMatches)) {
      if (lowerText.includes(`timezone is ${keyword}`) || lowerText.includes(`use ${keyword}`) || lowerText.includes(`i am in ${keyword}`) || lowerText.includes(`i live in ${keyword}`) || lowerText === `i use ${keyword}`) {
        effectiveTimeZone = tz;
        setTimeZone(tz);
        localStorage.setItem('user_timezone', tz);
        
        setDoc(doc(db, 'users', user.uid, 'settings', 'config'), { timeZone: tz }, { merge: true }).catch(console.error);
        break;
      }
    }

    // Combine document content with user text if a text/code file was attached
    let fullUserPrompt = textToSend;
    if (filePayload) {
      const fileHeader = `[ATTACHED FILE: ${filePayload.name}]\n\`\`\`\n${filePayload.content}\n\`\`\`\n\n`;
      fullUserPrompt = `${fileHeader}${textToSend || 'Please analyze or use the attached file.'}`;
    }

    let currentChatId = activeChatId;
    const currentKey = activeKey.trim();

    try {
      if (!currentChatId) {
        const chatTitle = textToSend ? textToSend.slice(0, 30) : (filePayload ? `File: ${filePayload.name}` : "Image Query");
        const chatRef = await addDoc(collection(db, 'users', user.uid, 'chats'), {
          title: chatTitle,
          timestamp: serverTimestamp(),
          aiId: selectedAI?.id || 'logan-default'
        });
        currentChatId = chatRef.id;
        setActiveChatId(currentChatId);
      } else {
        await updateDoc(doc(db, 'users', user.uid, 'chats', currentChatId), {
          timestamp: serverTimestamp()
        });
      }

      await addDoc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'), {
        role: 'user', 
        text: fullUserPrompt, 
        image: imagePayload || null,
        timestamp: serverTimestamp()
      });

      let replyText = "";

      if (currentMode === 'creative') {
        const encodedPrompt = encodeURIComponent(textToSend);
        const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=600&nologo=true`;
        replyText = `🎨 **Image Generated** (via Pollinations AI)\n\n![${textToSend}](${imageUrl})`;
      } else if (!currentKey) {
        replyText = await queryLocalBrain(fullUserPrompt);
      } else {
        let sysPrompt = SYSTEM_PROMPT_STANDARD;
        if (currentMode === 'canvas') {
          sysPrompt = SYSTEM_PROMPT_CANVAS;
        } else if (selectedAI) {
          sysPrompt = `You are a custom AI Persona named ${selectedAI.name}. PERSONALITY: ${selectedAI.personality}`;
        }

        const formattedHistory = (messages || [])
          .filter(m => (m && typeof m.text === 'string' && m.text.trim() !== '') || m.image)
          .slice(-10)
          .map(m => ({
            role: m.role === 'assistant' || m.role === 'model' ? 'assistant' : 'user',
            content: m.text || '',
            image: m.image || null
          }));

        const requestMessages = [
          ...formattedHistory,
          { role: 'user', content: fullUserPrompt, image: imagePayload || null }
        ];

        const data = await fetchWithRetry(
          '/api/chat',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              provider: provider,
              apiKey: currentKey,
              messages: requestMessages,
              systemPrompt: sysPrompt,
              userTimeZone: effectiveTimeZone
            })
          }
        );

        replyText = data.reply && data.reply.trim() !== "" ? data.reply : await queryLocalBrain(fullUserPrompt);
      }

      await addDoc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'), {
        role: 'assistant', text: replyText, timestamp: serverTimestamp()
      });

    } catch (err) {
      console.error("Messaging Error:", err);
      
      const exactErrorText = `❌ **Exact Error Message:**\n\`\`\`\n${err.message || err}\n\`\`\``;
      const fallbackText = await queryLocalBrain(fullUserPrompt);
      const combinedReply = `${exactErrorText}\n\n---\n\n*Falling back to web search & local brain:*\n${fallbackText}`;

      if (currentChatId) {
        await addDoc(collection(db, 'users', user.uid, 'chats', currentChatId, 'messages'), {
          role: 'assistant', text: combinedReply, timestamp: serverTimestamp()
        }).catch(e => console.error("Firestore Fallback Error:", e));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    handleSendWithText(input.trim(), selectedImage, attachedFile);
  };

  const parseElicitations = (text) => {
    if (!text || typeof text !== 'string') return { cleanText: text, elicitations: null };

    const groupRegex = /<ElicitationsGroup\s+message="([^"]+)">([\s\S]*?)<\/ElicitationsGroup>/gi;
    const elicitationRegex = /<Elicitation\s+label="([^"]+)"\s+query="([^"]+)"\s*\/?>/gi;

    let match = groupRegex.exec(text);
    if (!match) return { cleanText: text, elicitations: null };

    const groupMessage = match[1];
    const groupContent = match[2];
    const elicitationsList = [];

    let itemMatch;
    while ((itemMatch = elicitationRegex.exec(groupContent)) !== null) {
      elicitationsList.push({
        label: itemMatch[1],
        query: itemMatch[2]
      });
    }

    const cleanText = text.replace(groupRegex, '').trim();

    return {
      cleanText,
      elicitations: {
        message: groupMessage,
        items: elicitationsList
      }
    };
  };

  const saveSettings = async () => {
    localStorage.setItem('ai_provider', provider);
    localStorage.setItem('user_timezone', timeZone);
    
    if (openaiKey.trim()) {
      localStorage.setItem('openai_api_key', openaiKey.trim());
    } else {
      localStorage.removeItem('openai_api_key');
    }

    if (googleKey.trim()) {
      localStorage.setItem('gemini_api_key', googleKey.trim());
    } else {
      localStorage.removeItem('gemini_api_key');
    }

    localStorage.setItem('logan_theme', JSON.stringify(theme));

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'settings', 'config'), {
          provider,
          openaiKey: openaiKey.trim(),
          googleKey: googleKey.trim(),
          timeZone,
          theme,
          updatedAt: serverTimestamp()
        }, { merge: true });
      } catch (err) {
        console.error("Failed to save settings to Firestore:", err);
      }
    }

    setIsSettingsOpen(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const getAccentColor = () => {
    if (currentMode === 'creative') return '#ec4899';
    if (currentMode === 'canvas') return '#eab308';
    if (selectedAI) return '#06b6d4';
    return theme.color;
  };

  if (authLoading) return <div className="h-screen w-full bg-[#0B1120] flex items-center justify-center text-slate-500">Loading LoganGPT...</div>;
  if (!user) return <Login />;

  return (
    <div className="flex h-[100dvh] bg-[#0B1120] text-slate-100 font-sans overflow-hidden" style={{ '--accent': getAccentColor() }}>
      
      {/* Hidden File Inputs */}
      <input 
        type="file" 
        ref={imageInputRef} 
        onChange={handleImageSelect} 
        accept="image/*" 
        className="hidden" 
      />
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept=".txt,.js,.jsx,.ts,.tsx,.json,.html,.css,.md,.csv,.py,.c,.cpp" 
        className="hidden" 
      />

      {/* Sidebar Overlay */}
      <div className={`fixed inset-0 bg-black/60 z-20 lg:hidden transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setIsSidebarOpen(false)} />

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 w-72 bg-[#020617] border-r border-white/5 z-30 transform transition-transform duration-300 flex flex-col shadow-2xl ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-2"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center border border-white/10"><Cloud className="w-4 h-4 text-emerald-400" /></div><span className="font-semibold text-sm tracking-wide text-slate-200">History</span></div>
          <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden text-slate-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-3"><button onClick={() => createNewChat(null)} className="w-full flex items-center justify-center gap-2 text-white p-3 rounded-xl shadow-lg transition-all font-medium hover:brightness-110" style={{ backgroundColor: theme.color }}><Plus className="w-4 h-4" /> New Standard Chat</button></div>
        
        {/* Custom AIs */}
        <div className="px-3 pb-2 border-b border-white/5">
          <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-2 px-1"><span>My AIs</span><button onClick={() => setIsCreatorOpen(true)} className="hover:text-white transition-colors"><Plus className="w-3 h-3" /></button></div>
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {customAIs.map(ai => (
              <button key={ai.id} onClick={() => createNewChat(ai)} className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors group ${selectedAI?.id === ai.id ? 'bg-cyan-900/30 text-cyan-400 border border-cyan-500/30' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}>
                <span className="flex items-center gap-2 truncate"><Bot className="w-3 h-3" /> {ai.name}</span>
                <span onClick={(e) => deleteCustomAI(e, ai.id)} className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity"><X className="w-3 h-3" /></span>
              </button>
            ))}
            {customAIs.length === 0 && <div className="text-[10px] text-slate-600 px-1">No custom personas yet.</div>}
          </div>
        </div>

        {/* Chat History List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.length === 0 && <div className="text-center text-xs text-slate-600 mt-4 italic">No conversation history</div>}
          {chats.map(chat => (
            <div key={chat.id} onClick={() => { setActiveChatId(chat.id); setIsSidebarOpen(false); }} className={`group relative flex items-center gap-3 p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-all border border-transparent ${activeChatId === chat.id ? 'bg-white/10 border-white/10' : ''}`}>
              <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate text-slate-200">{chat.title}</div><div className="text-[10px] text-slate-500 mt-0.5">{chat.timestamp?.seconds ? new Date(chat.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</div></div>
              <button onClick={(e) => deleteChat(e, chat.id)} className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-500 hover:text-red-400 transition-opacity"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
        </div>
        <div className="p-4 border-t border-white/5 bg-black/20"><button onClick={handleLogout} className="flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-white hover:bg-white/5 p-2 rounded-lg transition-colors w-full border border-white/5"><LogOut className="w-3.5 h-3.5" /> Sign Out</button></div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full min-w-0 relative bg-[#0B1120]">
        <header className="absolute top-0 w-full bg-[#0B1120]/80 backdrop-blur-md border-b border-white/5 px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-slate-400"><Menu className="w-6 h-6" /></button>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-white">LoganGPT</span>
              <div className="hidden sm:flex items-center gap-2">
                {selectedAI ? (
                  <span className="flex items-center gap-1 text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded-full border border-cyan-500/30 font-bold tracking-wide"><Bot className="w-3 h-3" /> {selectedAI.name.toUpperCase()}</span>
                ) : currentMode === 'creative' ? (
                  <span className="flex items-center gap-1 text-[10px] bg-pink-500/20 text-pink-400 px-2 py-0.5 rounded-full border border-pink-500/30 font-bold tracking-wide animate-pulse"><Paintbrush className="w-3 h-3" /> CREATIVE</span>
                ) : currentMode === 'canvas' ? (
                  <span className="flex items-center gap-1 text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 font-bold tracking-wide animate-pulse"><Layout className="w-3 h-3" /> CANVAS</span>
                ) : !activeKey ? (
                  <span className="flex items-center gap-1 text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-white/5"><WifiOff className="w-3 h-3" /> Offline + DDG</span>
                ) : (
                  <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 uppercase">{provider} ACTIVE</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => toggleMode('creative')} className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${currentMode === 'creative' ? 'bg-pink-600 text-white shadow-lg shadow-pink-500/20' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}><ImageIcon className="w-4 h-4" /></button>
            <button onClick={() => toggleMode('canvas')} className={`p-1.5 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${currentMode === 'canvas' ? 'bg-yellow-600 text-white shadow-lg shadow-yellow-500/20' : 'bg-white/5 text-slate-400 hover:text-white hover:bg-white/10'}`}><Layout className="w-4 h-4" /></button>
            <button onClick={() => setIsSettingsOpen(true)} className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"><Settings className="w-5 h-5" /></button>
          </div>
        </header>

        <main ref={chatContainerRef} className="flex-1 overflow-y-auto pt-20 pb-32 px-4 scroll-smooth flex flex-col">
          {(!activeChatId && messages.length === 0) ? (
            <div className="max-w-2xl mx-auto mt-12 md:mt-20 text-center space-y-8 px-4 animate-fade-in my-auto">
              <div className="relative w-20 h-20 mx-auto">
                <div className={`absolute inset-0 bg-gradient-to-tr rounded-2xl blur-xl opacity-50 animate-pulse ${selectedAI ? 'from-cyan-500 to-blue-500' : currentMode === 'creative' ? 'from-pink-500 to-rose-500' : currentMode === 'canvas' ? 'from-yellow-500 to-orange-500' : 'from-violet-500 to-indigo-500'}`}></div>
                <div className="relative w-20 h-20 bg-slate-900 rounded-2xl border border-white/10 flex items-center justify-center shadow-2xl" style={{ borderColor: getAccentColor() }}>
                  {selectedAI ? <Bot className="w-10 h-10 text-cyan-400" /> : currentMode === 'creative' ? <Paintbrush className="w-10 h-10 text-pink-400" /> : currentMode === 'canvas' ? <Layout className="w-10 h-10 text-yellow-400" /> : <Monitor className="w-10 h-10" style={{ color: theme.color }} />}
                </div>
              </div>
              <div><h2 className="text-3xl font-bold text-white mb-2">{selectedAI ? `Talking to ${selectedAI.name}.` : currentMode === 'creative' ? "Creative Mode Active." : currentMode === 'canvas' ? "Canvas Engine Ready." : "System Online."}</h2><p className="text-slate-400">{selectedAI ? (selectedAI.isRoleplay ? "Roleplay Mode Active. Internet disabled." : "Custom Persona Active.") : currentMode === 'creative' ? "Generates images via Pollinations AI." : currentMode === 'canvas' ? "Builds single-file web apps instantly." : (activeKey ? `Connected via ${provider.toUpperCase()} Provider.` : "Running in Offline Mode with DuckDuckGo Search.")}</p></div>
            </div>
          ) : (
            <div className="max-w-3xl w-full mx-auto space-y-6 flex flex-col flex-1">
              {messages.map((msg, idx) => {
                const { cleanText, elicitations } = parseElicitations(msg.text);

                return (
                  <div key={msg.id || idx} className={`flex gap-3 sm:gap-4 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex-shrink-0 flex items-center justify-center text-xs font-bold border border-white/10 shadow-lg ${msg.role === 'user' ? 'bg-slate-800 text-slate-300' : 'text-white'}`} style={msg.role === 'assistant' || msg.role === 'model' ? { backgroundColor: selectedAI ? '#06b6d4' : currentMode === 'creative' ? '#ec4899' : currentMode === 'canvas' ? '#eab308' : theme.color } : {}}>
                      {msg.role === 'user' ? <User className="w-4 h-4"/> : (selectedAI ? <Bot className="w-4 h-4"/> : currentMode === 'creative' ? <ImageIcon className="w-4 h-4"/> : currentMode === 'canvas' ? <Layout className="w-4 h-4"/> : <Zap className="w-4 h-4" fill="currentColor"/>)}
                    </div>
                    <div className={`relative w-full max-w-[88%] sm:max-w-[85%] rounded-2xl p-3.5 sm:p-4 text-sm leading-7 shadow-md border overflow-hidden min-w-0 ${msg.role === 'user' ? 'bg-slate-800 text-white border-white/5' : 'bg-slate-900/50 text-slate-200 border-white/5'}`}>
                      
                      {/* Attached User Image Display */}
                      {msg.image && (
                        <div className="mb-3 rounded-xl overflow-hidden border border-white/10 max-w-sm">
                          <img src={msg.image} alt="User upload" className="w-full h-auto object-cover" />
                        </div>
                      )}

                      {cleanText && (
                        <ReactMarkdown 
                          className="prose prose-invert max-w-none break-words" 
                          remarkPlugins={[remarkGfm, remarkMath]} 
                          rehypePlugins={[rehypeKatex]}
                          components={{ 
                            table({node, ...props}) {
                              return (
                                <div className="w-full overflow-x-auto my-3 rounded-xl border border-white/10">
                                  <table className="w-full text-left border-collapse min-w-[500px]" {...props} />
                                </div>
                              );
                            },
                            th({node, ...props}) {
                              return <th className="bg-slate-900 p-2.5 text-xs font-bold text-slate-300 border-b border-white/10" {...props} />;
                            },
                            td({node, ...props}) {
                              return <td className="p-2.5 text-xs border-b border-white/5 text-slate-300" {...props} />;
                            },
                            code({node, inline, className, children, ...props}) {
                              const match = /language-(\w+)/.exec(className || '');
                              const codeString = String(children).replace(/\n$/, '');

                              if (!inline && match && match[1] === 'html') {
                                return (
                                  <div className="my-2 p-3 sm:p-4 bg-slate-950/90 border border-yellow-500/40 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg w-full">
                                    <div className="flex items-center gap-2 text-yellow-400 font-semibold text-xs sm:text-sm">
                                      <Layout className="w-4 h-4 flex-shrink-0"/> 
                                      <span>Interactive Canvas Built</span>
                                    </div>
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                      <button 
                                        onClick={() => copyToClipboard(codeString)} 
                                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-white/10 hover:bg-white/20 text-slate-200 border border-white/10 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                                      >
                                        {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                        <span>{copiedCode ? "Copied!" : "Copy Code"}</span>
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setCanvasCode(codeString);
                                          setIsCanvasPreviewOpen(true);
                                        }} 
                                        className="flex-1 sm:flex-none justify-center px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-md shadow-yellow-500/20"
                                      >
                                        <Play className="w-3.5 h-3.5" fill="currentColor"/> 
                                        <span>Launch App</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return inline ? (
                                <code className="bg-white/10 rounded px-1.5 py-0.5 text-xs font-mono break-all" {...props}>
                                  {children}
                                </code>
                              ) : (
                                <div className="w-full overflow-x-auto my-2 rounded-xl border border-white/10">
                                  <pre className="p-3 bg-black/30 min-w-full font-mono text-xs">
                                    <code className={className} {...props}>{children}</code>
                                  </pre>
                                </div>
                              );
                            },
                            img: ({node, ...props}) => <img {...props} className="rounded-lg shadow-lg max-w-full h-auto border border-white/10 mt-2 mb-2" alt="Generated" /> 
                          }}
                        >
                          {cleanText}
                        </ReactMarkdown>
                      )}

                      {/* Elicitation Suggestions Render Box */}
                      {elicitations && (
                        <div className="mt-4 pt-3 border-t border-white/10 space-y-2.5">
                          {elicitations.message && (
                            <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-300">
                              <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                              <span>{elicitations.message}</span>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {elicitations.items.map((item, eIdx) => (
                              <button
                                key={eIdx}
                                onClick={() => sendQueryDirectly(item.query)}
                                className="px-3 py-2 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-200 hover:text-white text-xs font-medium rounded-xl transition-all shadow-md active:scale-95 text-left flex items-center gap-1.5"
                              >
                                <span>{item.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {isLoading && (
                <div className="flex gap-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold shadow-lg animate-pulse" style={{ backgroundColor: getAccentColor() }}>
                    <Zap className="w-4 h-4" fill="currentColor"/>
                  </div>
                  <div className="bg-slate-900/50 rounded-2xl p-4 text-xs text-slate-400 border border-white/5 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-slate-500 animate-ping" /> Routing request through {provider.toUpperCase()} ladder...
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        {/* Input Bar */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-[#0B1120] via-[#0B1120]/90 to-transparent p-4">
          <div className="max-w-3xl mx-auto flex flex-col gap-2">
            
            {/* Attachment Preview Tags */}
            {selectedImage && (
              <div className="relative self-start bg-slate-900 border border-white/10 rounded-xl p-1.5 shadow-xl flex items-center gap-2">
                <img src={selectedImage} alt="Upload preview" className="w-10 h-10 rounded-lg object-cover" />
                <span className="text-xs text-slate-300 pr-2">Image attached</span>
                <button 
                  type="button" 
                  onClick={() => setSelectedImage(null)}
                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {attachedFile && (
              <div className="relative self-start bg-slate-900 border border-white/10 rounded-xl p-2 shadow-xl flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-400" />
                <span className="text-xs text-slate-200 font-medium truncate max-w-xs">{attachedFile.name}</span>
                <button 
                  type="button" 
                  onClick={() => setAttachedFile(null)}
                  className="p-1 text-slate-400 hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            <form onSubmit={handleSend} className="relative flex items-center bg-slate-900/80 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl focus-within:border-white/20 transition-all">
              
              {/* Attachment Picker Menu (Hidden in Creative Mode) */}
              {currentMode !== 'creative' && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsAttachMenuOpen(!isAttachMenuOpen)}
                    className="p-3 ml-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-xl transition-colors"
                    title="Attach File or Image"
                  >
                    <Paperclip className="w-4 h-4" />
                  </button>

                  {/* Dropdown Options */}
                  {isAttachMenuOpen && (
                    <div className="absolute bottom-14 left-2 bg-slate-900 border border-white/10 rounded-2xl p-1.5 shadow-2xl flex flex-col gap-1 z-30 min-w-[160px] backdrop-blur-xl">
                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left"
                      >
                        <ImageIcon className="w-4 h-4 text-pink-400" />
                        <span>Send Image</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors text-left"
                      >
                        <FileText className="w-4 h-4 text-emerald-400" />
                        <span>Upload File / Code</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isListening 
                    ? "Listening... Speak now!" 
                    : selectedAI ? `Message ${selectedAI.name}...` : currentMode === 'creative' ? "Describe an image to generate..." : currentMode === 'canvas' ? "Describe an app or game to build..." : "Message LoganGPT..."
                }
                className={`w-full bg-transparent px-3 py-4 text-sm text-white focus:outline-none placeholder-slate-500 pr-24 ${currentMode === 'creative' ? 'pl-5' : ''}`}
              />

              {/* Voice Input Microphone Button */}
              <button
                type="button"
                onClick={toggleVoiceInput}
                className={`absolute right-12 p-2.5 rounded-xl transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'text-slate-400 hover:text-white hover:bg-white/10'
                }`}
                title={isListening ? "Stop listening" : "Start voice input"}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Send Button */}
              <button 
                type="submit"
                disabled={(!input.trim() && !selectedImage && !attachedFile) || isLoading}
                className="absolute right-2 p-2.5 rounded-xl text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md"
                style={{ backgroundColor: getAccentColor() }}
              >
                <Send className="w-4 h-4"/>
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Canvas Preview Modal */}
      {isCanvasPreviewOpen && canvasCode && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col">
          <div className="bg-slate-900 border-b border-white/10 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2 text-yellow-400 font-semibold text-sm">
              <Layout className="w-4 h-4"/> Live Prototyping Canvas
            </div>
            <button onClick={() => setIsCanvasPreviewOpen(false)} className="p-1 text-slate-400 hover:text-white rounded-lg">
              <X className="w-5 h-5"/>
            </button>
          </div>
          <iframe 
            title="LoganGPT Live Canvas"
            srcDoc={canvasCode}
            className="w-full flex-1 border-none bg-white"
          />
        </div>
      )}

      {/* Custom AI Creator Modal */}
      {isCreatorOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg text-white flex items-center gap-2"><Bot className="w-5 h-5 text-cyan-400"/> Create Persona</h3>
              <button onClick={() => setIsCreatorOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Name</label>
                <input type="text" value={newAIName} onChange={(e) => setNewAIName(e.target.value)} placeholder="e.g. Code Mentor, Pirate AI" className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-cyan-500" />
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">Personality Instructions</label>
                <textarea value={newAIPersonality} onChange={(e) => setNewAIPersonality(e.target.value)} placeholder="Describe how it talks and acts..." className="w-full bg-slate-950 border border-white/10 rounded-xl p-3 text-white h-24 focus:outline-none focus:border-cyan-500 resize-none" />
              </div>
              <div className="flex items-center justify-between pt-2">
                <span className="text-slate-300">Roleplay Mode</span>
                <button onClick={() => setNewAIRoleplay(!newAIRoleplay)} className={`p-1 rounded-full transition-colors ${newAIRoleplay ? 'text-cyan-400' : 'text-slate-600'}`}>
                  {newAIRoleplay ? <ToggleRight className="w-7 h-7"/> : <ToggleLeft className="w-7 h-7"/>}
                </button>
              </div>
              <button onClick={createCustomAI} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-semibold py-3 rounded-xl transition-all shadow-lg shadow-cyan-900/20 mt-4">
                Build Persona
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="font-bold text-lg text-white flex items-center gap-2"><Settings className="w-5 h-5"/> Settings</h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="space-y-6">
              {/* Provider Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Active Provider</label>
                <div className="grid grid-cols-2 gap-2">
                  <button 
                    onClick={() => setProvider('openai')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${provider === 'openai' ? 'border-violet-500 bg-violet-500/20 text-white' : 'border-white/5 bg-slate-950 text-slate-400'}`}
                  >
                    OpenAI
                  </button>
                  <button 
                    onClick={() => setProvider('google')}
                    className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${provider === 'google' ? 'border-emerald-500 bg-emerald-500/20 text-white' : 'border-white/5 bg-slate-950 text-slate-400'}`}
                  >
                    Google Gemini
                  </button>
                </div>
              </div>

              {/* TimeZone Setting */}
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">System Timezone</label>
                <div className="relative">
                  <Globe className="absolute left-3 top-3.5 w-4 h-4 text-slate-500"/>
                  <select 
                    value={timeZone} 
                    onChange={(e) => setTimeZone(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-violet-500"
                  >
                    <option value="UTC">UTC (Default)</option>
                    <option value="America/New_York">Eastern Time (US / EST / EDT)</option>
                    <option value="America/Chicago">Central Time (US / CST / CDT)</option>
                    <option value="America/Denver">Mountain Time (US / MST / MDT)</option>
                    <option value="America/Los_Angeles">Pacific Time (US / PST / PDT)</option>
                    <option value="Europe/London">London (GMT / BST)</option>
                  </select>
                </div>
              </div>

              {/* OpenAI Key Input */}
              {provider === 'openai' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">OpenAI API Key</label>
                    <a 
                      href="[https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 flex items-center gap-1 transition-colors font-medium"
                    >
                      Get Key <ExternalLink className="w-3 h-3"/>
                    </a>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-3.5 w-4 h-4 text-slate-500"/>
                    <input 
                      type="password" 
                      value={openaiKey} 
                      onChange={(e) => setOpenaiKey(e.target.value)} 
                      placeholder="sk-proj-..." 
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-violet-500" 
                    />
                  </div>
                </div>
              )}

              {/* Google Gemini Key Input */}
              {provider === 'google' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Google Gemini API Key</label>
                    <a 
                      href="[https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors font-medium"
                    >
                      Get Key <ExternalLink className="w-3 h-3"/>
                    </a>
                  </div>
                  <div className="relative">
                    <Key className="absolute left-3 top-3.5 w-4 h-4 text-slate-500"/>
                    <input 
                      type="password" 
                      value={googleKey} 
                      onChange={(e) => setGoogleKey(e.target.value)} 
                      placeholder="AIzaSy..." 
                      className="w-full bg-slate-950 border border-white/10 rounded-xl py-3 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-emerald-500" 
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Accent Theme</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { color: '#8b5cf6', hover: '#7c3aed', name: 'Violet' },
                    { color: '#3b82f6', hover: '#2563eb', name: 'Blue' },
                    { color: '#10b981', hover: '#059669', name: 'Emerald' },
                    { color: '#f59e0b', hover: '#d97706', name: 'Amber' }
                  ].map((t) => (
                    <button 
                      key={t.name}
                      onClick={() => setTheme(t)}
                      className={`p-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-semibold transition-all ${theme.name === t.name ? 'border-white bg-white/10 text-white' : 'border-white/5 bg-slate-950 text-slate-400'}`}
                    >
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10 flex justify-end gap-3">
                <button onClick={() => setIsSettingsOpen(false)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
                <button onClick={saveSettings} className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-all shadow-lg">Save Changes</button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
