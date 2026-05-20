import React, { useState } from 'react';
import { 
  Eye, 
  EyeOff, 
  RefreshCw, 
  Calendar,
  User as UserIcon,
  Lock,
  ChevronDown,
  Settings,
  ShieldCheck
} from 'lucide-react';
import { 
  collection, 
  getDocs, 
  query, 
  where,
  limit,
  addDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { AccountService } from '../lib/accountService';
import { googleSignIn } from '../lib/auth';

interface LoginViewProps {
  onLogin: (account: any, period: string) => void;
}

export function LoginView({ onLogin }: LoginViewProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [period, setPeriod] = useState(new Date().getFullYear().toString());
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [connectionStatus, setConnectionStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  React.useEffect(() => {
    // Simple check to see if we can reach Firestore
    const checkConnection = async () => {
      try {
        const q = query(collection(db, 'accounts'), limit(1));
        await getDocs(q);
        setConnectionStatus('connected');
      } catch (err) {
        console.error('Firestore check failed:', err);
        setConnectionStatus('disconnected');
      }
    };
    checkConnection();
  }, []);

  const [showBridgeSettings, setShowBridgeSettings] = useState(false);
  const [manualProxyUrl, setManualProxyUrl] = useState(() => localStorage.getItem('ais_apps_script_url') || '');

  const saveManualProxy = () => {
    if (manualProxyUrl) {
      localStorage.setItem('ais_apps_script_url', manualProxyUrl.trim());
      alert('Bridge URL tersimpan! Sistem sekarang akan mencoba login via Apps Script.');
      setShowBridgeSettings(false);
      window.location.reload();
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await googleSignIn();
      if (!res) {
        setLoading(false);
        return;
      }

      const email = res.user.email;
      if (!email) throw new Error('Email tidak ditemukan dari akun Google.');

      console.log(`[Google Login] Authenticated as: ${email}`);

      // 1. Check for hardcoded System Admin (Developer)
      if (email === 'keusulbar4@gmail.com') {
         console.log('[Google Login] System Admin Identified.');
         onLogin({
           id: 'admin-google',
           username: 'admin',
           email: email,
           role: 'Administrator',
           opdName: 'Administrator System (Developer)'
         }, period);
         return;
      }

      // 2. Check in Firestore for matching email
      try {
        const q = query(collection(db, 'accounts'), where('email', '==', email));
        const snapshot = await getDocs(q);
        if (!snapshot.empty) {
           const userData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
           console.log('[Google Login] User found in Firestore via email mapping.');
           onLogin(userData, period);
           return;
        }
      } catch (e) {
        console.warn('[Google Login] Firestore email check failed:', e);
      }

      // 3. Fallback to Apps Script Bridge to check email
      try {
        const scriptAccounts = await AccountService.listAccounts();
        const found = scriptAccounts.find(a => a.email && a.email.toLowerCase() === email.toLowerCase());
        if (found) {
           console.log('[Google Login] User found in Apps Script via email mapping.');
           onLogin({ id: 'temp-' + Date.now(), ...found }, period);
           return;
        }
      } catch (e) {
        console.warn('[Google Login] Apps Script email check failed:', e);
      }

      // If no mapping found
      setError(`AKUN GOOGLE TIDAK TERDAFTAR: Email "${email}" belum dihubungkan ke OPD mana pun. Silakan hubungi Admin untuk mendaftarkan email ini di menu Manajemen Akun.`);
      setLoading(false);

    } catch (err: any) {
      console.error(err);
      setError('Gagal login dengan Google: ' + (err.code || err.message));
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !period) return;

    setLoading(true);
    setError(null);

    try {
      const cleanUsername = username.trim();
      const cleanPassword = password.trim();

      // Check for hardcoded admin first
      if (cleanUsername === 'admin' && cleanPassword === 'admin123') {
          onLogin({
              id: 'admin-manual',
              username: 'admin',
              role: 'Administrator',
              opdName: 'Administrator System'
          }, period);
          return;
      }

      // We'll try to find the user specifically by username first (case sensitive and insensitive)
      // This is more performant and often works better with security rules than collection listing
      const accountsCol = collection(db, 'accounts');
      let finalUser = null;
      let snapshot = null;

      try {
        console.log(`[Login] Searching for user in Firestore: "${cleanUsername}"`);
        
        // Attempt 1: Specific query (lowercase username is common)
        const q1 = query(accountsCol, where('username', '==', cleanUsername.toLowerCase()));
        snapshot = await getDocs(q1);
        
        // Attempt 2: If nothing found, try exact case
        if (snapshot.empty) {
            console.log('[Login] Not found with lowercase, trying exact case...');
            const q2 = query(accountsCol, where('username', '==', cleanUsername));
            snapshot = await getDocs(q2);
        }

        // Attempt 3: Final fallback to "list all" 
        if (snapshot.empty) {
            console.log('[Login] Still not found, fetching ALL accounts to filter in-memory...');
            snapshot = await getDocs(query(accountsCol));
        }
        
        // Filter in-memory
        const matchingDocs = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() as any }))
          .filter(data => data.username && data.username.toLowerCase() === cleanUsername.toLowerCase())
          .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
        
        finalUser = matchingDocs[0];

      } catch (dbErr: any) {
        console.warn('[Login] Firestore direct fetch failed, will rely purely on Apps Script Proxy if available:', dbErr.message);
      }
      
      // FALLBACK TO APPS SCRIPT (Prioritize if configured or if Firestore failed)
      console.log('[Login] Checking Apps Script Proxy...');
      try {
        const scriptAccounts = await AccountService.listAccounts();
        if (scriptAccounts.length > 0) {
          const foundInScript = scriptAccounts.find(a => a.username && a.username.toLowerCase() === cleanUsername.toLowerCase());
          
          if (foundInScript) {
            console.log('[Login] User found in Apps Script!');
            
            // If we found it in script but not in Firestore, auto-sync to Firestore for speed next time (async)
            if (!finalUser) {
               console.log('[Login] User missing from Firestore context, preparing session data.');
               finalUser = { id: 'temp-' + Date.now(), ...foundInScript };
               
               // Try to sync to Firestore in background (don't block if it fails)
               addDoc(collection(db, 'accounts'), {
                 ...foundInScript,
                 createdAt: Date.now()
               }).catch(() => {});
            } else {
               // Update existing user with fresh script data
               finalUser = { ...finalUser, ...foundInScript };
            }
          }
        }
      } catch (e) {
        console.warn('[Login] Apps Script Proxy check failed:', e);
      }
      
      if (!finalUser) {
        console.warn('Login failure: Username not found:', cleanUsername);
        const project = (db as any)._databaseId?.projectId || 'Unknown';
        setError(`USER "${cleanUsername.toUpperCase()}" TIDAK DITEMUKAN.
          
          • Cek Database: Project ID adalah "${project}"
          • Cek Admin: Pastikan admin sudah mendaftarkan akun ini.
          • Solusi: Jika menggunakan PC lain, Admin harus mengaktifkan "Apps Script Bridge" di Manajemen Akun.`);
        setLoading(false);
        return;
      }

      // Check password (keep password case-sensitive for security)
      if (finalUser.password !== cleanPassword) {
        console.warn('Login failure: Incorrect password for:', cleanUsername);
        setError('PASSWORD SALAH. Harap periksa kembali password yang anda masukkan.');
        setLoading(false);
        return;
      }

      onLogin(finalUser, period);
    } catch (err: any) {
      console.error('Login error detail:', err);
      // Check for common Firestore errors
      if (err.message?.includes('permission-denied')) {
        setError('Akses ditolak. Sedang memperbarui sistem keamanan, harap tunggu sebentar.');
      } else {
        setError('Terjadi kesalahan koneksi (' + (err.code || 'ERR') + '). Silakan coba lagi.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/50 via-white to-white">
      <div className="max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="mb-10 text-center">
          <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-indigo-200 animate-bounce-slow relative">
            <UserIcon className="w-10 h-10 text-white" />
            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full border-2 border-white shadow-sm">v2.1</div>
            
            <div className={cn(
              "absolute -bottom-2 -right-2 px-2 py-1 rounded-lg text-[7px] font-black uppercase tracking-widest border-2 shadow-sm transition-all",
              connectionStatus === 'checking' && "bg-slate-100 text-slate-400 border-white",
              connectionStatus === 'connected' && "bg-emerald-500 text-white border-white animate-pulse",
              connectionStatus === 'disconnected' && "bg-red-500 text-white border-white"
            )}>
              {connectionStatus === 'checking' ? 'SYNC...' : connectionStatus === 'connected' ? 'CLOUD ONLINE' : 'OFFLINE'}
            </div>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase italic">
            Risk Management <span className="text-indigo-600">System</span>
          </h1>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 opacity-60">Provinsi Sulawesi Barat</p>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.08)] border border-slate-100 overflow-hidden transform transition hover:scale-[1.01]">
          <div className="p-10">
            <button 
              type="button"
              onClick={handleGoogleLogin}
              disabled={loading}
              className="w-full mb-8 bg-white border-2 border-indigo-100 hover:border-indigo-400 text-indigo-600 rounded-[1.5rem] py-5 text-[11px] font-black uppercase tracking-widest transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 shadow-xl shadow-indigo-50/50 group"
            >
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4 group-hover:scale-110 transition-transform" alt="Google" />
              <span>MASUK DENGAN AKUN GOOGLE (OTOMATIS)</span>
            </button>

            <div className="relative mb-8">
               <div className="absolute inset-0 flex items-center">
                 <div className="w-full border-t border-slate-100"></div>
               </div>
               <div className="relative flex justify-center">
                 <span className="px-4 bg-white text-[9px] font-black text-slate-300 uppercase tracking-[0.3em]">Atau Manual</span>
               </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="space-y-6">
                {/* Username */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <UserIcon className="w-3 h-3" />
                    Username
                  </label>
                  <div className="relative group">
                    <input 
                      type="text"
                      className="w-full bg-indigo-50/30 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all"
                      placeholder="Username"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      autoComplete="username"
                    />
                  </div>
                </div>

                {/* Password */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Lock className="w-3 h-3" />
                    Password
                  </label>
                  <div className="relative">
                    <input 
                      type={showPassword ? "text" : "password"}
                      className="w-full bg-indigo-50/30 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all"
                      placeholder="Masukkan password..."
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                    />
                    <button 
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-2 text-slate-300 hover:text-indigo-500 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Periode / Tahun */}
                <div className="space-y-3">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                    <Calendar className="w-3 h-3" />
                    Tahun Anggaran Aktif
                  </label>
                  <div className="relative">
                    <select 
                      className="w-full bg-indigo-50/30 border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all appearance-none"
                      value={period}
                      onChange={e => setPeriod(e.target.value)}
                    >
                      <option value="2024">TAHUN 2024</option>
                      <option value="2025">TAHUN 2025</option>
                      <option value="2026">TAHUN 2026</option>
                      <option value="2027">TAHUN 2027</option>
                    </select>
                    <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <ChevronDown className="w-4 h-4" />
                    </div>
                  </div>
                </div>
              </div>

              {error && (
                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl animate-in fade-in zoom-in duration-300 space-y-3">
                  <p className="text-[11px] font-black text-red-500 uppercase tracking-tight text-center leading-relaxed">{error}</p>
                  <button 
                    type="button"
                    onClick={() => {
                        setUsername('');
                        setPassword('');
                        setError(null);
                        window.location.reload();
                    }}
                    className="w-full py-2 bg-white border border-red-200 rounded-xl text-[9px] font-black text-red-400 uppercase hover:bg-red-50 transition"
                  >
                    Refresh Halaman (Muat Ulang)
                  </button>
                </div>
              )}

              <button 
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white rounded-[1.5rem] py-5 text-sm font-black uppercase tracking-widest hover:bg-indigo-700 hover:shadow-2xl hover:shadow-indigo-200 transition-all duration-300 transform active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3 relative overflow-hidden group shadow-xl shadow-indigo-100"
              >
                <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
                {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : null}
                {loading ? 'MEMPROSES...' : 'MASUK DENGAN AKUN SISTEM'}
              </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-50">
               <button 
                 onClick={() => setShowBridgeSettings(!showBridgeSettings)}
                 className="w-full text-[9px] font-black text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-[0.2em] flex items-center justify-center gap-2"
               >
                 <Settings className="w-3 h-3" />
                 {showBridgeSettings ? 'Tutup Bridge Settings' : 'Bantuan Login (Apps Script Bridge)'}
               </button>

               {showBridgeSettings && (
                 <div className="mt-4 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100 animate-in slide-in-from-top-2 duration-300">
                    <p className="text-[9px] text-indigo-900 font-bold mb-3 leading-relaxed uppercase tracking-tighter">
                      Jika Anda menggunakan PC baru & login gagal, masukkan URL Apps Script Bridge yang diberikan oleh Admin:
                    </p>
                    <div className="flex flex-col gap-2">
                       <input 
                         type="text" 
                         className="w-full bg-white border border-indigo-200 rounded-xl px-4 py-3 text-[10px] font-bold text-indigo-600 outline-none focus:ring-4 focus:ring-indigo-500/10 placeholder:text-slate-300"
                         placeholder="https://script.google.com/macros/s/.../exec"
                         value={manualProxyUrl}
                         onChange={e => setManualProxyUrl(e.target.value)}
                       />
                       <button 
                         onClick={saveManualProxy}
                         className="w-full py-3 bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-900 transition shadow-lg"
                       >
                         Simpan & Hubungkan PC Ini
                       </button>
                       <p className="text-[8px] text-slate-400 text-center mt-2 font-medium">
                         Pengaturan ini akan tersimpan permanen di browser PC ini.
                       </p>
                    </div>
                 </div>
               )}
            </div>
          </div>
        </div>
        
        <p className="mt-8 text-center text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex flex-col gap-2 italic">
          <span>&copy; {new Date().getFullYear()} PEMERINTAH PROVINSI SULAWESI BARAT</span>
          <span className="opacity-40">Database Project: {(db as any)._databaseId?.projectId || 'ais-pre-6cf535yuejqg2yo5z52auv-813309225437'}</span>
        </p>
      </div>
    </div>
  );
}
