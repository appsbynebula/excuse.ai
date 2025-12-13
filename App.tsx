import React, { useState, useEffect, useRef } from 'react';
import {
  Siren,
  ChevronRight,
  Zap,
  RotateCcw,
  Share2,
  Download,

  Fingerprint,
  Lock,
  Camera,
  History,
  X,
  CreditCard,
  CheckCircle2,
  ImagePlus,
  Mail,
  ArrowLeft
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { AppView, ExcuseOption, UserState, HistoryItem } from './types';
import { generateEvidence } from './services/geminiService';
import { supabase } from './src/lib/supabaseClient';
import { CyberShield } from './src/components/CyberShield';

// Initialize Stripe outside component
// const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

// --- Constants ---
const THEME = {
  bg: 'bg-[#050505]',
  surface: 'bg-[#111111]',
  accent: 'text-[#FF5722]',
  accentBg: 'bg-[#FF5722]',
  border: 'border-white/10',
};

const QUICK_EXCUSES: ExcuseOption[] = [
  { id: '1', label: 'Flat Tire', emoji: '🚗', prompt: 'a flat car tire on the side of the road, asphalt, night time' },
  { id: '2', label: 'Fever', emoji: '🌡️', prompt: 'a digital thermometer showing 102.4 degrees fever, blurry background' },
  { id: '3', label: 'Plumbing', emoji: '💧', prompt: 'water leaking from a pipe under a sink, messy, puddle' },
  { id: '4', label: 'Traffic', emoji: '🚥', prompt: 'heavy traffic jam view from inside a car dashboard, rain on windshield' },
];

const LOADING_MESSAGES = [
  "Degrading image quality...",
  "Adding camera shake...",
  "Simulating bad lighting...",
  "Corrupting meta-data...",
  "Generating alibi..."
];

// Simple beep sound for entry
const ENTRY_SOUND = "data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU"; // Placeholder, simplified

// --- Components ---

const Button = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon: Icon,
  disabled
}: {
  children?: React.ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'premium';
  className?: string;
  icon?: React.ElementType;
  disabled?: boolean;
}) => {
  const baseStyles = "w-full py-4 rounded-2xl font-bold text-lg flex items-center justify-center gap-2 transition-all active:scale-95 duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100";
  const variants = {
    primary: `${THEME.accentBg} text-white shadow-[0_0_20px_rgba(255,87,34,0.3)] hover:shadow-[0_0_30px_rgba(255,87,34,0.5)]`,
    secondary: "bg-white text-black hover:bg-gray-200",
    ghost: "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/5",
    premium: "bg-gradient-to-r from-yellow-500 to-amber-600 text-white shadow-[0_0_20px_rgba(234,179,8,0.3)]"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseStyles} ${variants[variant]} ${className}`}
    >
      {Icon && <Icon size={20} />}
      {children}
    </button>
  );
};

const Input = ({
  placeholder,
  type = 'text',
  value,
  onChange
}: {
  placeholder: string,
  type?: string,
  value?: string,
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
}) => (
  <input
    type={type}
    placeholder={placeholder}
    value={value}
    onChange={onChange}
    className={`w-full ${THEME.surface} text-white p-4 rounded-xl border ${THEME.border} focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] outline-none text-lg placeholder-white/20 transition-all`}
  />
);

// --- Main App ---

export default function App() {
  const [view, setView] = useState<AppView>(AppView.AUTH);
  const [prompt, setPrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null); // For image-to-image
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [userState, setUserState] = useState<UserState>({
    credits: 0,
    isPremium: false,
    isGuest: false,
    history: []
  });
  const [loadingMessage, setLoadingMessage] = useState(LOADING_MESSAGES[0]);
  const [hasWelcomed, setHasWelcomed] = useState(false); // Track if celebration happened
  const [authMode, setAuthMode] = useState<'menu' | 'email'>('menu'); // Auth screen state
  const [email, setEmail] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Persistence & Init ---

  useEffect(() => {
    // 1. Check Supabase Session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        // Load user profile/credits if you have a DB table, or just basic auth for now
        // For now, we assume standard users start with 0 credits unless paid
        // We can keep localStorage for history if we don't have a DB sync yet
        const saved = localStorage.getItem('excuse_ai_state');
        if (saved) {
          const parsed = JSON.parse(saved);
          setUserState(prev => ({ ...prev, ...parsed, isGuest: false, credits: Math.min(parsed.credits, 999) })); // Safety check
        } else {
          setView(AppView.DASHBOARD);
        }
      }
    });


    // 2. Check Stripe Return
    const query = new URLSearchParams(window.location.search);
    if (query.get('success')) {
      setUserState(prev => {
        const newState = { ...prev, isPremium: true, credits: 999 };
        localStorage.setItem('excuse_ai_state', JSON.stringify(newState));
        return newState;
      });
      setView(AppView.DASHBOARD);
      // Clean URL
      window.history.replaceState({}, document.title, window.location.pathname);
      setTimeout(() => triggerConfetti(), 500);
    } else if (query.get('canceled')) {
      setView(AppView.PREMIUM);
      alert("Payment canceled.");
    }
  }, []);

  // Save state on change
  useEffect(() => {
    localStorage.setItem('excuse_ai_state', JSON.stringify(userState));
  }, [userState]);

  // Play sound effect
  const playSound = () => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContext) {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.value = 800;
        gain.gain.value = 0.1;
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 0.5);
        osc.stop(ctx.currentTime + 0.5);
      }
    } catch (e) {
      console.error("Audio play failed", e);
    }
  };

  // Confetti Effect
  const triggerConfetti = () => {
    const duration = 2000;
    const end = Date.now() + duration;

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#FF5722', '#ffffff']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#FF5722', '#ffffff']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());
  };

  // Loading text cycle
  useEffect(() => {
    if (view === AppView.GENERATING) {
      let i = 0;
      const interval = setInterval(() => {
        i = (i + 1) % LOADING_MESSAGES.length;
        setLoadingMessage(LOADING_MESSAGES[i]);
      }, 800);
      return () => clearInterval(interval);
    }
  }, [view]);

  // Effect when entering dashboard (Run only once)
  useEffect(() => {
    if (view === AppView.DASHBOARD && !hasWelcomed) {
      triggerConfetti();
      playSound();
      setHasWelcomed(true);
    }
  }, [view, hasWelcomed]);

  const handleLogin = async (isGuest: boolean) => {
    if (isGuest) {
      setUserState(prev => ({ ...prev, isGuest: true, credits: 0 }));
      setView(AppView.DASHBOARD);
      return;
    }

    // Provider Login (Apple/Google placeholders if keys not set, or throw error)
    // For specific provider buttons:
    // supabase.auth.signInWithOAuth({ provider: 'google' });
  };

  const handleEmailLogin = async () => {
    if (!email) return;
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) {
      alert(error.message);
    } else {
      alert('Check your email for the login link!');
      setAuthMode('menu');
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReferenceImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleQuickExcuse = (option: ExcuseOption) => {
    setPrompt(option.label); // Fill text
  };

  const handleGenerate = async () => {
    if (!prompt) return;

    if (userState.credits <= 0 && !userState.isPremium) {
      setView(AppView.PREMIUM);
      return;
    }

    setView(AppView.GENERATING);

    try {
      const imageUrl = await generateEvidence(prompt, referenceImage);
      setGeneratedImage(imageUrl);

      // Update state
      setUserState(prev => {
        const newHistory = prev.isGuest ? [] : [{
          id: Date.now().toString(),
          prompt: prompt,
          date: new Date().toLocaleDateString(),
          imageUrl: imageUrl
        }, ...prev.history];

        return {
          ...prev,
          credits: Math.max(0, prev.credits - 1),
          history: newHistory
        };
      });

      setView(AppView.RESULT);
    } catch (e) {
      console.error(e);
      setView(AppView.DASHBOARD);
    }
  };

  const handleReset = () => {
    setGeneratedImage(null);
    setPrompt('');
    setReferenceImage(null);
    setView(AppView.DASHBOARD);
  };

  const handleShare = async () => {
    if (!generatedImage) return;

    try {
      // 1. Fetch the image and convert to Blob
      const response = await fetch(generatedImage);
      const blob = await response.blob();

      // 2. Create a File object
      const file = new File([blob], "evidence.png", { type: blob.type });

      // 3. Check for native sharing support
      if (navigator.share) {
        await navigator.share({
          title: 'Evidence',
          text: 'Here is the proof you asked for.',
          files: [file],
        });
      } else {
        alert("Native sharing not supported on this browser. Use 'Save to Camera Roll' instead.");
      }
    } catch (error) {
      console.error("Error sharing:", error);
      alert("Could not share image.");
    }
  };

  const handleUnlock = () => {
    // Redirect to the Stripe Payment Link provided
    window.location.href = "https://buy.stripe.com/test_3cIbJ08ih453g3ge7E8AE02";
  };

  // --- Screens ---

  const AuthScreen = () => (
    <div className={`h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden ${THEME.bg}`}>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] glow-effect rounded-full blur-[80px] opacity-40 pointer-events-none" />

      <div className="z-10 w-full max-w-md flex flex-col items-center space-y-12">
        {/* Logo Section */}
        <div className="flex flex-col items-center space-y-6">
          <div className="relative group">
            {/* Glow behind the icon */}
            <div className={`absolute inset-0 ${THEME.accentBg} blur-[40px] opacity-40 group-hover:opacity-60 transition-opacity duration-500`}></div>
            {/* Main App Icon Container */}
            <div className="relative bg-black p-8 rounded-[2rem] shadow-2xl flex items-center justify-center border border-white/5">
              <CyberShield className={THEME.accent} size={64} strokeWidth={1.5} />
            </div>
          </div>
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-white">Excuse.AI</h1>
            <p className="text-white/50 text-lg font-medium max-w-[280px]">
              Stop making up bad lies. <br />
              <span className={THEME.accent}>Let AI generate the evidence.</span>
            </p>
          </div>
        </div>

        <div className="w-full space-y-4">
          {authMode === 'menu' ? (
            <>
              <Button variant="secondary" onClick={() => supabase.auth.signInWithOAuth({ provider: 'apple' })} icon={Fingerprint}>
                Continue with Apple
              </Button>
              <Button variant="ghost" onClick={() => supabase.auth.signInWithOAuth({ provider: 'google' })}>
                Continue with Google
              </Button>
              <Button variant="ghost" onClick={() => setAuthMode('email')} icon={Mail}>
                Use Email
              </Button>

              <div className="pt-4">
                <button
                  onClick={() => handleLogin(true)}
                  className="w-full text-center text-sm text-white/30 font-semibold hover:text-white transition-colors"
                >
                  Enter Guest Mode
                </button>
              </div>
            </>
          ) : (
            <div className="space-y-4 w-full animate-fade-in-up">
              <Input
                placeholder="Email Address"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <Button variant="primary" onClick={handleEmailLogin}>
                Send Magic Link
              </Button>
              <button
                onClick={() => setAuthMode('menu')}
                className="w-full flex items-center justify-center gap-2 text-white/50 hover:text-white py-2 font-medium"
              >
                <ArrowLeft size={16} /> Back
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const DashboardScreen = () => (
    <div className={`min-h-screen w-full flex flex-col ${THEME.bg} animate-fade-in-up`}>
      {/* Header */}
      <header className="p-6 flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <Siren className={THEME.accent} size={24} />
          <span className="font-bold text-lg tracking-tight">Crisis Center</span>
        </div>
        <div className="bg-white/5 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-full flex items-center gap-2">
          <Zap size={14} className={userState.credits > 0 ? 'text-yellow-400' : 'text-gray-500'} fill={userState.credits > 0 ? 'currentColor' : 'none'} />
          <span className="text-sm font-mono font-bold">{userState.credits} Credit</span>
        </div>
      </header>

      <main className="flex-1 flex flex-col p-6 max-w-md mx-auto w-full relative z-10 pb-20">
        <div className="flex-1 flex flex-col space-y-8">

          {/* Main Input */}
          <div className="space-y-4">
            <div>
              <label className="text-white/60 text-sm font-bold uppercase tracking-wider ml-1">
                What happened?
              </label>
              <p className="text-xs text-white/30 ml-1 mt-1">Describe the situation you want to fake so we can generate the perfect alibi photo.</p>
            </div>

            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. My car won't start because the battery is dead..."
              className={`w-full ${THEME.surface} text-white p-6 rounded-3xl border ${THEME.border} focus:border-[#FF5722] focus:ring-1 focus:ring-[#FF5722] outline-none text-xl font-medium resize-none placeholder-white/20 transition-all h-32`}
            />
          </div>

          {/* Reference Image Input */}
          <div className="space-y-2">
            <label className="text-white/60 text-xs font-bold uppercase tracking-wider ml-1 flex items-center gap-2">
              <Camera size={14} /> Add Realism (Optional)
            </label>
            <div
              onClick={() => fileInputRef.current?.click()}
              className={`w-full h-24 rounded-2xl border border-dashed ${THEME.border} ${THEME.surface} flex items-center justify-center cursor-pointer hover:bg-white/5 transition-colors relative overflow-hidden`}
            >
              {referenceImage ? (
                <div className="relative w-full h-full group">
                  <img src={referenceImage} alt="Reference" className="w-full h-full object-cover opacity-60" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                    <span className="text-xs text-white font-bold">Change Image</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-1">
                  <ImagePlus className="mx-auto text-white/40" size={20} />
                  <p className="text-xs text-white/40 font-medium">Upload base photo</p>
                </div>
              )}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-white/40 text-xs font-bold uppercase tracking-wider ml-1">
              Quick Emergencies
            </label>
            <div className="grid grid-cols-2 gap-3">
              {QUICK_EXCUSES.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => handleQuickExcuse(opt)}
                  className={`flex items-center gap-3 p-4 rounded-xl ${THEME.surface} border ${THEME.border} hover:bg-white/5 transition-colors text-left group active:scale-95`}
                >
                  <span className="text-2xl group-hover:scale-110 transition-transform duration-200">{opt.emoji}</span>
                  <span className="font-semibold text-white/90 text-sm">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* History Section - Only for logged in users */}
          {!userState.isGuest && userState.history.length > 0 && (
            <div className="space-y-3 pt-4 border-t border-white/5">
              <label className="text-white/40 text-xs font-bold uppercase tracking-wider ml-1 flex items-center gap-2">
                <History size={12} /> Past Alibis
              </label>
              <div className="space-y-2">
                {userState.history.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5">
                    <img src={item.imageUrl} alt="thumb" className="w-10 h-10 rounded-lg object-cover grayscale opacity-70" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{item.prompt}</p>
                      <p className="text-xs text-white/30">{item.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="mt-8 space-y-4">
          <Button onClick={handleGenerate} disabled={!prompt}>
            Generate Proof
          </Button>

          {!userState.isPremium && (
            <button
              onClick={() => setView(AppView.PREMIUM)}
              className="w-full flex items-center justify-center gap-2 text-sm text-[#FF5722] opacity-80 hover:opacity-100 py-2"
            >
              <Lock size={14} />
              <span className="font-bold">Unlock Crisis Pack ($4.99)</span>
            </button>
          )}
        </div>
      </main>
    </div>
  );

  const PremiumScreen = () => (
    <div className={`min-h-screen w-full flex flex-col ${THEME.bg} relative overflow-hidden animate-fade-in-up`}>
      <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-[#FF5722]/20 to-transparent pointer-events-none" />

      <button
        onClick={() => setView(AppView.DASHBOARD)}
        className="absolute top-6 left-6 z-20 bg-black/40 p-2 rounded-full text-white hover:bg-white/10"
      >
        <X size={24} />
      </button>

      <div className="flex-1 flex flex-col items-center p-8 pt-20 max-w-md mx-auto w-full z-10 text-center">
        <div className="bg-gradient-to-br from-orange-500 to-red-600 p-4 rounded-3xl shadow-2xl shadow-orange-500/20 mb-6">
          <Lock className="text-white" size={40} />
        </div>

        <h2 className="text-3xl font-bold text-white mb-2">Crisis Pack</h2>
        <p className="text-white/60 mb-10">Unrestricted access to the world's best excuse generator.</p>

        <div className="w-full space-y-4 mb-10 text-left">
          {[
            "Unlimited Generations (No daily limits)",
            "Higher Quality '4K' Evidence",
            "Remove Watermarks",
            "Priority Server Access",
            "Stealth App Icon"
          ].map((feature, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-white/5 border border-white/5">
              <CheckCircle2 className="text-green-500 shrink-0" size={20} />
              <span className="font-medium text-white/90">{feature}</span>
            </div>
          ))}
        </div>

        <div className="w-full space-y-3 mt-auto">
          <Button variant="premium" onClick={handleUnlock}>
            Pay $4.99 via Stripe
          </Button>
          <p className="text-xs text-white/30">
            Secured by Stripe. One-time payment.
          </p>
        </div>
      </div>
    </div>
  );

  const GeneratingScreen = () => (
    <div className={`h-screen w-full flex flex-col items-center justify-center p-6 ${THEME.bg} relative`}>
      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20"></div>
      <div className="text-center space-y-8 z-10">
        <div className="relative inline-block">
          <div className={`w-20 h-20 rounded-full border-4 border-t-[#FF5722] border-r-transparent border-b-transparent border-l-transparent animate-spin`}></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <Siren className={THEME.accent} size={32} />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white animate-pulse">Processing...</h2>
          <p className="text-white/50 font-mono text-sm">{loadingMessage}</p>
        </div>
      </div>
    </div>
  );

  const ResultScreen = () => (
    <div className="h-screen w-full bg-black relative flex flex-col">
      {/* The Evidence */}
      <div className="flex-1 relative overflow-hidden bg-gray-900">
        {generatedImage && (
          <div className="relative w-full h-full">
            <img
              src={generatedImage}
              alt="Generated Evidence"
              className={`w-full h-full object-cover animate-in fade-in duration-700 ${userState.isGuest ? 'blur-xl' : ''}`}
            />
            {userState.isGuest && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 z-30 p-8 text-center">
                <Lock size={48} className="text-white mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">Evidence Redacted</h3>
                <p className="text-white/70 mb-6">Create a free account to view your generated evidence.</p>
                <Button onClick={() => setView(AppView.AUTH)}>Sign In / Register</Button>
              </div>
            )}
          </div>
        )}

        {/* Overlay gradient for readability of controls */}
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/90 to-transparent pointer-events-none" />

        {/* Top Controls */}
        <div className="absolute top-0 inset-x-0 p-6 flex justify-between items-start z-20">
          <button
            onClick={handleReset}
            className="bg-black/40 backdrop-blur-md p-3 rounded-full text-white/80 hover:bg-black/60 transition-all border border-white/10"
          >
            <RotateCcw size={20} />
          </button>
          <div className="bg-red-500/20 backdrop-blur-md px-3 py-1 rounded-full border border-red-500/30">
            <span className="text-red-500 text-xs font-bold uppercase tracking-widest flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
              Evidence
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="bg-black p-6 pb-10 space-y-4 border-t border-white/10 z-20">
        <div className="grid grid-cols-2 gap-4">
          <Button variant="secondary" icon={Download}>
            Save to Camera Roll
          </Button>
          <Button variant="ghost" icon={Share2} onClick={handleShare}>
            Share
          </Button>
        </div>
        <p className="text-center text-white/30 text-xs mt-4">
          Generated images are for entertainment purposes only.
        </p>
      </div>
    </div>
  );

  // --- Render Logic ---

  return (
    <>
      {view === AppView.AUTH && <AuthScreen />}
      {view === AppView.DASHBOARD && <DashboardScreen />}
      {view === AppView.GENERATING && <GeneratingScreen />}
      {view === AppView.RESULT && <ResultScreen />}
      {view === AppView.PREMIUM && <PremiumScreen />}
    </>
  );
}