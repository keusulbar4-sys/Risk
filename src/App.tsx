import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Settings, 
  ShieldAlert, 
  Activity, 
  BarChart3, 
  ClipboardList, 
  MessageSquare, 
  CheckCircle2, 
  Plus, 
  FileSpreadsheet,
  LogOut,
  ChevronRight,
  Menu,
  X,
  PlusCircle,
  Users,
  Shield,
  ChevronLeft,
  ShieldCheck,
  RefreshCw
} from 'lucide-react';
import { User } from 'firebase/auth';
import { doc, updateDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { initAuth, googleSignIn, logout, getAccessToken } from './lib/auth';
import { cn } from './lib/utils';
import { DashboardView } from './components/Dashboard';
import { ContextView } from './components/ContextView';
import { GenericRiskTable } from './components/RiskTable';
import { IdentificationView } from './components/IdentificationView';
import { AccountManagementView } from './components/AccountManagementView';
import { LoginView } from './components/LoginView';
import { COLUMN_DEFINITIONS } from './constants/columns';

// Sidebar Items
const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: '1-context', label: '1. Penetapan Konteks', icon: Settings },
  { id: '2-identification', label: '2. Identifikasi Risiko', icon: ShieldAlert },
  { id: '3-analysis', label: '3. Analisis Risiko', icon: BarChart3 },
  { id: '4-evaluation', label: '4. Evaluasi Risiko', icon: Activity },
  { id: '5-rtp', label: '5. Rencana Tindak', icon: ClipboardList },
  { id: '6-comm', label: '6. Komunikasi', icon: MessageSquare },
  { id: '7-monitor', label: '7. Pemantauan', icon: CheckCircle2 },
  { id: '8-log', label: '8. Catatan Kejadian', icon: FileSpreadsheet },
  { id: '11-account', label: 'XI. Manajemen Akun', icon: Users },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<{ account: any, period: string } | null>(() => {
    const saved = localStorage.getItem('ais_user_session');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return null; }
    }
    return null;
  });
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false); // Default false if we have session
  const [activeTab, setActiveTab] = useState('dashboard');
  const [spreadsheetId, setSpreadsheetId] = useState<string | null>(() => {
    const saved = localStorage.getItem('ais_user_session');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.account?.spreadsheetId || null;
      } catch (e) { return null; }
    }
    return null;
  });
  const [viewingAs, setViewingAs] = useState<any | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [tabsData, setTabsData] = useState<Record<string, any[]>>({});
  const [spreadsheetError, setSpreadsheetError] = useState(false);
  const [settings, setSettings] = useState<{ targetFolderId?: string; masterSheetId?: string; masterToken?: string; appsScriptUrl?: string }>(() => {
    const saved = localStorage.getItem('ais_global_settings');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return {}; }
    }
    return {};
  });

  // Global Settings Listener
  useEffect(() => {
    // Setup Config listener - this might fail if unauthenticated, but we want to try
    const docRef = doc(db, 'config', 'global');
    const unsub = onSnapshot(docRef, 
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          setSettings(data);
          localStorage.setItem('ais_global_settings', JSON.stringify(data));
          if (data.appsScriptUrl) {
             localStorage.setItem('ais_apps_script_url', data.appsScriptUrl);
          }
        }
      },
      (error) => {
        console.warn('[App] Config listener failed (likely unauthenticated):', error.message);
      }
    );
    return () => unsub();
  }, []);

  // Context State
  const [contextData, setContextData] = useState({
    pemda: 'PEMERINTAH PROVINSI SULAWESI BARAT',
    tahun: '2026',
    periode: '2025-2029',
    urusan: '-',
    opd: '-',
    sumberData: '-',
    tujuanStrategis: '-',
    informasiLain: '-',
  });

  const [sasaran, setSasaran] = useState([
    { no: 1, text: 'Peningkatan transparansi dan akuntabilitas dalam pengelolaan keuangan daerah guna mencegah korupsi dan penyalahgunaan anggaran' },
    { no: 2, text: 'Penerapan sistem pengawasan berbasis teknologi seperti e-audit dan e-monitoring terhadap anggaran dan proyek pemerintah.' },
    { no: 3, text: 'Mendorong peran aktif masyarakat dalam pengawasan pemerintahan, melalui sistem pelaporan yang mudah diakses.' },
  ]);

  const [ikuSasaran, setIkuSasaran] = useState([
    { no: 1, text: 'Indeks Pelayanan Publik', value: '1,11' },
    { no: 2, text: 'Indeks Integritas Nasional', value: '64' },
  ]);

  const [program, setProgram] = useState([
    { no: 1, text: 'Program penunjang urusan pemerintahan daerah' },
    { no: 2, text: 'Program penyelenggaraan pengawasan' },
    { no: 3, text: 'Program perumusan kebijakan, pendampingan dan asistensi' },
  ]);

  const [assessments, setAssessments] = useState<any[]>([
    { id: 1, tujuan: '', sasaran: '', program: '', iku: '' }
  ]);

  const [signature, setSignature] = useState({
    location: '-',
    date: '-',
    name: '-',
    title: '-',
    nip: '-'
  });

  const updateTabData = (tabId: string, rows: any[]) => {
    setTabsData(prev => ({ ...prev, [tabId]: rows }));
  };

  // Initial loading and session recovery
  useEffect(() => {
    const savedSession = localStorage.getItem('ais_user_session');
    if (savedSession) {
      try {
        const parsed = JSON.parse(savedSession);
        // Sync account state
        if (parsed.account?.id && parsed.account?.id !== 'admin-manual') {
          const unsub = onSnapshot(doc(db, 'accounts', parsed.account.id), (dt) => {
            if (dt.exists()) {
              const accountData = { id: dt.id, ...dt.data() } as any;
              setSession(prev => prev ? { ...prev, account: accountData } : null);
              if (accountData.spreadsheetId) setSpreadsheetId(accountData.spreadsheetId);
              localStorage.setItem('ais_user_session', JSON.stringify({ ...parsed, account: accountData }));
            }
          });
          return () => unsub();
        }
      } catch (e) {
        console.error('Failed to sync saved session');
      }
    }

    // Checking Google Auth in background
    initAuth(
      (u, t) => {
        setUser(u);
        setToken(t);
      },
      () => {
        // Auth failure (normal if not using Google)
      }
    );
  }, []);

  const handleManualLogin = async () => {
    try {
      const res = await googleSignIn();
      if (res) {
        setUser(res.user);
        setToken(res.accessToken);
      }
    } catch (error: any) {
      if (
        error.code === 'auth/popup-closed-by-user' || 
        error.code === 'auth/cancelled-popup-request' ||
        error.message?.includes('closed by user') ||
        error.message?.includes('cancelled by user')
      ) {
        console.log('User cancelled the login popup');
        return;
      }
      console.error(error);
      
      let msg = 'Gagal menghubungkan Akun Google.';
      if (error.message?.includes('Requested entity was not found') || error.message?.includes('not found')) {
        msg = 'ID Spreadsheet tidak ditemukan. Harap periksa ID di Manajemen Akun atau buat file baru.';
      } else if (error.code === 'auth/access-denied' || error.message?.includes('access_denied')) {
        msg = 'AKSES DITOLAK GOOGLE (Error 403). Email ini belum terdaftar sebagai "Test User" di Google Cloud Console, atau aplikasi masih dalam mode Testing.';
        alert(msg + '\n\nSilakan hubungi Administrator untuk mendaftarkan email Anda di Google Cloud Console (OAuth Consent Screen).');
        return;
      }
      
      alert(msg + '\n\nDetail: ' + (error.code || error.message));
    }
  };

  // Helper to extract ID from URL
  const extractId = (urlOrId: string | undefined) => {
    if (!urlOrId) return undefined;
    const trimmed = urlOrId.trim();
    
    // Match Google Sheets ID: /spreadsheets/d/ID/
    const sheetMatch = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (sheetMatch) return sheetMatch[1];
    
    // Match Drive Folder ID: /folders/ID
    const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (folderMatch) return folderMatch[1];

    // Match direct share link type /open?id=ID
    const driveMatch = trimmed.match(/[?&]id=([a-zA-Z0-9-_]+)/);
    if (driveMatch) return driveMatch[1];
    
    return trimmed;
  };

  const handleCreateSheet = async () => {
    if (!token || !session) return;
    try {
      const title = `Risk Register ${session.account.opdName} periode ${session.period}`;
        
      const res = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 
          title,
          folderId: extractId(settings?.targetFolderId) 
        })
      });
      const data = await res.json();
      if (data.spreadsheetId) {
        if (viewingAs) {
          await updateDoc(doc(db, 'accounts', viewingAs.id), {
            spreadsheetId: data.spreadsheetId
          });
          setViewingAs({ ...viewingAs, spreadsheetId: data.spreadsheetId });
        } else {
          // Update current session account spreadsheetId
          const accountId = session.account.id;
          if (accountId !== 'admin-manual') {
            await updateDoc(doc(db, 'accounts', accountId), {
              spreadsheetId: data.spreadsheetId
            });
          }
          setSession({
            ...session,
            account: { ...session.account, spreadsheetId: data.spreadsheetId }
          });
          setSpreadsheetId(data.spreadsheetId);
        }
        alert('Spreadsheet created and linked!');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to create spreadsheet');
    }
  };

  const handleViewAs = (account: any | null) => {
    setViewingAs(account);
    setSpreadsheetError(false);
    if (account) {
      const sid = account.spreadsheetId || null;
      setSpreadsheetId(sid);
      
      // Update context details to match the account we are viewing
      setContextData(prev => ({
        ...prev,
        opd: account.opdName,
        tahun: session?.period || '2026'
      }));
      
      setActiveTab('dashboard');
    } else {
      // Revert to own account data
      const sid = session?.account?.spreadsheetId || null;
      setSpreadsheetId(sid);
      if (session) {
        setContextData(prev => ({
          ...prev,
          opd: session.account.opdName,
          tahun: session.period
        }));
      }
    }
  };

  const handleLogin = (account: any, period: string) => {
    // Clear existing data before switching account context
    setTabsData({});
    setViewingAs(null);
    setSpreadsheetError(false);
    
    const newSession = { account, period };
    setSession(newSession);
    localStorage.setItem('ais_user_session', JSON.stringify(newSession));
    
    // Set spreadsheet ID immediately from account data if available
    if (account.spreadsheetId) {
      setSpreadsheetId(account.spreadsheetId);
    } else {
      setSpreadsheetId(null);
    }
    
    // Reset context basics for the new user
    setContextData({
      pemda: 'PEMERINTAH PROVINSI SULAWESI BARAT',
      tahun: period,
      periode: '2025-2029',
      urusan: '-',
      opd: account.opdName,
      sumberData: '-',
      tujuanStrategis: '-',
      informasiLain: '-',
    });

    setSasaran([]);
    setIkuSasaran([]);
    setProgram([]);
    setAssessments([{ id: 1, tujuan: '', sasaran: '', program: '', iku: '' }]);
    
    // Auto-navigate
    if (account.role === 'Administrator') {
      setActiveTab('11-account');
    } else {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = async () => {
    await logout();
    localStorage.removeItem('ais_user_session');
    
    // Clear all states to prevent leakage
    setUser(null);
    setSession(null);
    setViewingAs(null);
    setSpreadsheetId(null);
    setTabsData({});
    setContextData({
      pemda: 'PEMERINTAH PROVINSI SULAWESI BARAT',
      tahun: '2026',
      periode: '2025-2029',
      urusan: '-',
      opd: '-',
      sumberData: '-',
      tujuanStrategis: '-',
      informasiLain: '-',
    });
    setSasaran([
      { no: 1, text: 'Peningkatan transparansi dan akuntabilitas dalam pengelolaan keuangan daerah guna mencegah korupsi dan penyalahgunaan anggaran' },
      { no: 2, text: 'Penerapan sistem pengawasan berbasis teknologi seperti e-audit dan e-monitoring terhadap anggaran dan proyek pemerintah.' },
      { no: 3, text: 'Mendorong peran aktif masyarakat dalam pengawasan pemerintahan, melalui sistem pelaporan yang mudah diakses.' },
    ]);
    setIkuSasaran([
      { no: 1, text: 'Indeks Pelayanan Publik', value: '1,11' },
      { no: 2, text: 'Indeks Integritas Nasional', value: '64' },
    ]);
    setProgram([
      { no: 1, text: 'Program penunjang urusan pemerintahan daerah' },
      { no: 2, text: 'Program penyelenggaraan pengawasan' },
      { no: 3, text: 'Program perumusan kebijakan, pendampingan dan asistensi' },
    ]);
    setAssessments([{ id: 1, tujuan: '', sasaran: '', program: '', iku: '' }]);
  };

  const effectiveToken = token || settings?.masterToken || null;

  const renderContent = () => {
    // We allow rendering with effectiveToken (could be shared or own)
    if (!effectiveToken && activeTab !== '11-account') return null; 
    
    const commonProps = { 
      spreadsheetId: spreadsheetId!, 
      token: effectiveToken || '', 
      tahun: contextData.tahun,
      onSpreadsheetError: () => setSpreadsheetError(true)
    };
    
    switch (activeTab) {
      case 'dashboard':
        return (
          <div key={`dashboard-${spreadsheetId}`} className="h-full">
            <DashboardView {...commonProps} />
          </div>
        );
      case '1-context':
        return (
          <div key={`context-${spreadsheetId}`}>
            <ContextView 
              {...commonProps} 
              data={contextData} setData={setContextData}
              sasaran={sasaran} setSasaran={setSasaran}
              ikuSasaran={ikuSasaran} setIkuSasaran={setIkuSasaran}
              program={program} setProgram={setProgram}
              assessments={assessments} setAssessments={setAssessments}
              signature={signature} setSignature={setSignature}
            />
          </div>
        );
      case '2-identification':
        return (
          <div key={`id-${spreadsheetId}`}>
            <IdentificationView 
              {...commonProps} 
              rows={tabsData['2-identification'] || []}
              onRowsChange={rows => updateTabData('2-identification', rows)}
              menu1Assessments={assessments}
              opdName={viewingAs ? viewingAs.opdName : session?.account.opdName}
              tahun={contextData.tahun}
            />
          </div>
        );
      case '3-analysis':
        return (
          <div key={`analysis-${spreadsheetId}`}>
            <GenericRiskTable 
              {...commonProps}
              title="Analisis Risiko"
              description="Lakukan penilaian terhadap dampak dan kemungkinan terjadinya risiko."
              sheetName="3. Analisis"
              columns={COLUMN_DEFINITIONS.ANALYSIS}
              rows={tabsData['3-analysis'] || []}
              onRowsChange={rows => updateTabData('3-analysis', rows)}
            />
          </div>
        );
      case '4-evaluation':
        return (
          <div key={`eval-${spreadsheetId}`}>
            <GenericRiskTable 
              {...commonProps}
              title="Evaluasi Risiko"
              description="Bandingkan risiko awal dengan pengendalian yang ada untuk mendapatkan risiko sisa."
              sheetName="4. Evaluasi"
              columns={COLUMN_DEFINITIONS.EVALUATION}
              rows={tabsData['4-evaluation'] || []}
              onRowsChange={rows => updateTabData('4-evaluation', rows)}
            />
          </div>
        );
      case '5-rtp':
        return (
          <div key={`rtp-${spreadsheetId}`}>
            <GenericRiskTable 
              {...commonProps}
              title="Rencana Tindak Pengendalian (RTP)"
              description="Rancang rencana aksi untuk memitigasi risiko yang teridentifikasi."
              sheetName="5. RTP"
              columns={COLUMN_DEFINITIONS.RTP}
              rows={tabsData['5-rtp'] || []}
              onRowsChange={rows => updateTabData('5-rtp', rows)}
            />
          </div>
        );
      case '6-comm':
        return (
          <div key={`comm-${spreadsheetId}`}>
            <GenericRiskTable 
              {...commonProps}
              title="Komunikasi dan Konsultasi"
              description="Catat seluruh kegiatan komunikasi dan konsultasi terkait pengelolaan risiko."
              sheetName="6. Komunikasi"
              columns={COLUMN_DEFINITIONS.COMMUNICATION}
              rows={tabsData['6-comm'] || []}
              onRowsChange={rows => updateTabData('6-comm', rows)}
            />
          </div>
        );
      case '7-monitor':
        return (
          <div key={`monitor-${spreadsheetId}`}>
            <GenericRiskTable 
              {...commonProps}
              title="Pemantauan dan Review"
              description="Lakukan pemantauan berkala terhadap efektivitas pengendalian risiko."
              sheetName="7. Pemantauan"
              columns={COLUMN_DEFINITIONS.MONITORING}
              rows={tabsData['7-monitor'] || []}
              onRowsChange={rows => updateTabData('7-monitor', rows)}
            />
          </div>
        );
      case '8-log':
        return (
          <div key={`log-${spreadsheetId}`}>
            <GenericRiskTable 
              {...commonProps}
              title="Catatan Kejadian Risiko"
              description="Dokumentasikan kejadian risiko yang benar-benar terjadi sebagai pembelajaran."
              sheetName="8. Log"
              columns={COLUMN_DEFINITIONS.LOG}
              rows={tabsData['8-log'] || []}
              onRowsChange={rows => updateTabData('8-log', rows)}
            />
          </div>
        );
      case '11-account':
        return (
          <AccountManagementView 
            onViewAs={handleViewAs}
            currentViewingAs={viewingAs}
            token={token || ''}
            effectiveToken={effectiveToken || ''}
            settings={settings}
          />
        );
      default:
        return <DashboardView {...commonProps} />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!session) {
    return <LoginView onLogin={handleLogin} />;
  }

  const isSystemAdmin = user?.email === 'keusulbar4@gmail.com' || (session?.account?.role === 'Administrator' && session?.account?.username === 'admin');

  // Unified layout logic
  const renderMainContent = () => {
    const effectiveToken = token || settings?.masterToken || null;
    
    if ((!spreadsheetId || spreadsheetError) && activeTab !== '11-account' && !isSystemAdmin) {
      const displayOPD = viewingAs ? viewingAs.opdName : (session?.account?.opdName || 'User');
      
      return (
        <div className="flex-1 flex items-center justify-center p-8 bg-slate-50/50">
          <div className="max-w-2xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 animate-in zoom-in duration-500">
            <div className={cn("p-10 text-white flex justify-between items-start", spreadsheetError ? "bg-red-600" : "bg-indigo-600")}>
              <div>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">
                  {spreadsheetError ? "Spreadsheet Not Found (404)" : "Setup Cloud & Spreadsheet"}
                </h2>
                <p className="opacity-80 mt-2 font-medium">
                   {spreadsheetError 
                    ? "File Google Sheets yang terhubung tidak ditemukan atau Anda tidak memiliki akses."
                    : effectiveToken 
                      ? `Akun ${displayOPD} belum memiliki target file spreadsheet.`
                      : "Anda perlu menghubungkan akun Google untuk mengakses database cloud."
                   }
                </p>
              </div>
              {viewingAs ? (
                <button 
                  onClick={() => handleViewAs(null)}
                  className="bg-white/20 hover:bg-white/40 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                >
                  Back to Admin
                </button>
              ) : (
                  <button 
                    onClick={handleLogout}
                    className="bg-red-500/20 hover:bg-red-500/40 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-red-500/30"
                  >
                    Logout
                  </button>
              )}
            </div>
            <div className="p-10">
              {spreadsheetError && (
                <div className="mb-8 p-6 bg-red-50 border border-red-100 rounded-2xl">
                  <div className="flex items-center gap-3 text-red-600 mb-2">
                    <X className="w-5 h-5 font-bold" />
                    <h4 className="font-black text-sm uppercase tracking-tight">Koneksi Terputus</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4 leading-relaxed">
                    Kami tidak dapat menemukan file spreadsheet dengan ID yang terdaftar untuk akun ini. 
                    Klik tombol di bawah untuk membuat file baru atau hubungi administrator untuk memperbaiki ID manual.
                  </p>
                  <button 
                    onClick={() => {
                        setSpreadsheetId(null);
                        setSpreadsheetError(false);
                    }}
                    className="bg-white border border-red-200 text-red-500 px-4 py-2 rounded-lg text-[10px] font-black uppercase hover:bg-red-50 transition"
                  >
                    Reset & Buat File Baru
                  </button>
                </div>
              )}
              {!effectiveToken ? (
                 <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 flex flex-col items-center gap-6">
                    <div className="w-16 h-16 bg-white rounded-[2rem] flex items-center justify-center shadow-sm border border-slate-100">
                       <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
                    </div>
                    <div className="text-center space-y-2">
                       <h3 className="font-black text-slate-800 uppercase tracking-tight text-lg">SINKRONISASI DATABASE CLOUD</h3>
                       <p className="text-slate-500 text-[10px] max-w-[200px] mx-auto leading-relaxed">
                          {isSystemAdmin 
                            ? "Anda perlu mengaktifkan Token Cloud di halaman Manajemen Akun agar user lain dapat mengakses database."
                            : "Menunggu Administrator Sistem mengaktifkan akses database global..."
                          }
                       </p>
                    </div>
                    {isSystemAdmin && (
                      <button 
                        onClick={() => setActiveTab('11-account')}
                        className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase shadow-lg shadow-indigo-200"
                      >
                        Buka Manajemen Akun
                      </button>
                    )}
                 </div>
              ) : (
                <div className="space-y-8">
                  <div className="p-8 bg-indigo-50/50 rounded-3xl border border-indigo-100 group hover:border-indigo-300 transition-all">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                        <PlusCircle className="w-6 h-6 text-indigo-600" />
                      </div>
                      <div>
                        <h3 className="font-black text-slate-800 uppercase tracking-tight">Opsi 1: Buat Spreadsheet Baru</h3>
                        <p className="text-slate-500 text-xs mt-1">Kami akan membuat file <span className="font-bold italic text-indigo-600">Risk Register {displayOPD} periode {session?.period || '2026'}</span></p>
                      </div>
                    </div>
                    <button 
                      onClick={handleCreateSheet}
                      className="w-full bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-[0.98]"
                    >
                      Create & Link Now
                    </button>
                  </div>

                {isSystemAdmin && (
                  <>
                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-slate-100"></div>
                      </div>
                      <div className="relative flex justify-center">
                        <span className="px-4 bg-white text-[10px] font-black text-slate-300 uppercase tracking-[0.3em]">Administrator Only</span>
                      </div>
                    </div>

                    <div className="p-8 bg-slate-50 rounded-3xl border border-slate-200 group hover:border-slate-400 transition-all">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                          <ClipboardList className="w-6 h-6 text-slate-600" />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 uppercase tracking-tight">Opsi 2: Gunakan ID Manual</h3>
                          <p className="text-slate-500 text-xs mt-1">Tempel ID Spreadsheet (dari URL file Google Sheets).</p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <input 
                          type="text" 
                          placeholder="Spreadsheet ID..."
                          id="sheetIdInput"
                          className="flex-1 px-6 py-4 bg-white border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-slate-500/10 focus:border-slate-400 transition-all text-sm font-bold"
                        />
                        <button 
                          onClick={async () => {
                            const id = (document.getElementById('sheetIdInput') as HTMLInputElement).value;
                            if (id) {
                              if (viewingAs) {
                                await updateDoc(doc(db, 'accounts', viewingAs.id), {
                                  spreadsheetId: id
                                });
                                setViewingAs({ ...viewingAs, spreadsheetId: id });
                              } else {
                                const accountId = session?.account?.id;
                                if (accountId && accountId !== 'admin-manual') {
                                  await updateDoc(doc(db, 'accounts', accountId), {
                                    spreadsheetId: id
                                  });
                                }
                                setSession({
                                  ...session,
                                  account: { ...session.account, spreadsheetId: id }
                                });
                                setSpreadsheetId(id);
                              }
                            }
                          }}
                          className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition shadow-xl"
                        >
                          Link
                        </button>
                      </div>
                    </div>
                  </>
                )}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    }
    return renderContent();
  };

  return (
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <div className={cn(
        "bg-slate-900 text-slate-300 flex flex-col transition-all duration-300 ease-in-out border-r border-slate-800 relative z-40",
        sidebarOpen ? "w-72" : "w-20"
      )}>
        {/* Toggle Button */}
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute -right-3 top-20 bg-indigo-600 text-white p-1.5 rounded-full shadow-lg hover:bg-indigo-500 transition-all z-50 transform hover:scale-110"
        >
          {sidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        </button>

        <div className="p-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-900/40">
              <ShieldCheck className="w-6 h-6 text-white" />
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="font-black text-lg text-white tracking-tighter uppercase italic leading-none">RISK<span className="text-indigo-500 font-medium">PRO</span></span>
                <span className="text-[10px] font-black text-indigo-500/60 uppercase tracking-widest mt-1">Enterprise 2026</span>
              </div>
            )}
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            if (item.id === '11-account' && session.account.role !== 'Administrator') return null;
            
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 group relative",
                  activeTab === item.id 
                    ? "bg-indigo-600/20 text-indigo-400 border-l-4 border-indigo-500 shadow-[inset_4px_0_12px_rgba(79,70,229,0.1)]" 
                    : "hover:bg-slate-800 hover:text-white"
                )}
              >
                <item.icon className={cn("w-4 h-4 min-w-[16px]", activeTab === item.id ? "text-indigo-400" : "text-slate-500 group-hover:text-slate-300")} />
                {sidebarOpen && <span className={cn("truncate font-black text-[11px] uppercase tracking-wide", activeTab === item.id ? "text-white" : "text-slate-400")}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-6 bg-slate-950/50 mt-auto">
          <div className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-2xl border border-slate-800/80">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-black text-lg shadow-lg border-2 border-indigo-500/30">
              {(session?.account?.opdName || 'U')[0]}
            </div>
            {sidebarOpen && (
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-black text-white truncate uppercase tracking-tighter">{session?.account?.username || 'Unknown'}</span>
                <span className="text-[9px] opacity-40 uppercase truncate font-black tracking-widest text-indigo-400">{session?.account?.role || 'Guest'}</span>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <div className="mt-4 space-y-2">
              {!token && (
                <button 
                  onClick={handleManualLogin}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase text-indigo-400 hover:bg-indigo-500/10 hover:text-white transition-colors border border-indigo-500/20"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>Hubungkan Cloud</span>
                </button>
              )}
              <button 
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-black uppercase text-slate-500 hover:bg-red-500/10 hover:text-red-400 transition-colors border border-transparent hover:border-red-500/20"
              >
                <LogOut className="w-3 h-3" />
                <span>Sign Out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">{navItems.find(i => i.id === activeTab)?.label}</h1>
            {viewingAs ? (
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-50 border border-amber-200 rounded-full shadow-sm animate-pulse">
                <Shield className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[10px] font-black text-amber-700 uppercase tracking-widest flex items-center gap-1">
                  Viewing: <span className="underline decoration-2">{viewingAs.opdName}</span>
                </span>
                <button 
                  onClick={() => handleViewAs(null)}
                  className="ml-2 text-[9px] font-black text-red-500 hover:text-red-700 underline"
                >
                  [EXIT]
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-start translate-y-1">
                <span className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest border flex items-center gap-1.5 shadow-sm transition-colors",
                  effectiveToken ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-400 border-slate-100"
                )}>
                  <div className={cn("w-1.5 h-1.5 rounded-full", effectiveToken ? "bg-emerald-500 animate-pulse" : "bg-slate-300")}></div>
                  {effectiveToken ? (token ? 'Cloud Linked' : 'Cloud Shared') : 'Cloud Disconnected'}
                </span>
                <span className="text-[9px] font-black text-slate-400 mt-1 uppercase tracking-tighter italic opacity-60">
                  {session?.account?.opdName || 'No OPD'} • Periode {session?.period || '2026'}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
             {/* Redundant global sync button removed for cleaner UI */}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50 custom-scrollbar">
          <div className="max-w-[1600px] mx-auto">
            {renderMainContent()}
          </div>
        </div>
      </main>
    </div>
  );
}

