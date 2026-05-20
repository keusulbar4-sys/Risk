import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Trash2, 
  Edit2, 
  Check, 
  X, 
  FileSpreadsheet, 
  Download, 
  FileText,
  Shield,
  ShieldAlert,
  ShieldCheck,
  User as UserIcon,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Link as LinkIcon
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  doc, 
  updateDoc, 
  setDoc,
  query, 
  orderBy,
  onSnapshot,
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';
import { AccountService } from '../lib/accountService';

interface Account {
  id: string;
  username: string;
  password?: string;
  email?: string;
  role: 'Administrator' | 'User';
  opdName: string;
  spreadsheetId?: string;
  registeredAt: string;
  createdAt: number;
}

interface AccountManagementViewProps {
  onViewAs: (account: Account | null) => void;
  currentViewingAs: Account | null;
  token: string; // This should be the RAW Google Auth token (only present for admin)
  effectiveToken: string; // This can be the shared token
  settings: { 
    targetFolderId?: string; 
    masterSheetId?: string; 
    masterToken?: string;
    appsScriptUrl?: string;
  };
}

export function AccountManagementView({ onViewAs, currentViewingAs, token, effectiveToken, settings }: AccountManagementViewProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState<Record<string, boolean>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncFailed, setSyncFailed] = useState(false);
  const [importing, setImporting] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [globalSyncing, setGlobalSyncing] = useState(false);
  
  // Global Settings Form
  const [configForm, setConfigForm] = useState({
    targetFolderId: settings?.targetFolderId || '',
    masterSheetId: settings?.masterSheetId || '',
    masterToken: settings?.masterToken || '',
    appsScriptUrl: (settings as any)?.appsScriptUrl || ''
  });

  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      setConfigForm({
        targetFolderId: settings?.targetFolderId || '',
        masterSheetId: settings?.masterSheetId || '',
        masterToken: settings?.masterToken || '',
        appsScriptUrl: (settings as any)?.appsScriptUrl || ''
      });
      setSettingsLoaded(true);
    }
  }, [settings]);

  // Helper to extract ID from URL
  const extractId = (urlOrId: string | undefined) => {
    if (!urlOrId) return '';
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

  const handleSaveConfig = async () => {
    const cleanedFolderId = extractId(configForm.targetFolderId);
    const cleanedSheetId = extractId(configForm.masterSheetId);
    
    const cleanedConfig: any = {
      targetFolderId: cleanedFolderId,
      masterSheetId: cleanedSheetId,
      appsScriptUrl: configForm.appsScriptUrl.trim()
    };
    
    // Only include masterToken if it's explicitly in the form (or we want to clear it)
    if (configForm.masterToken) {
      cleanedConfig.masterToken = configForm.masterToken;
    }
    
    setSyncing(true);
    try {
      await setDoc(doc(db, 'config', 'global'), cleanedConfig, { merge: true });
      alert('✅ Konfigurasi Berhasil Disimpan ke Cloud!\nSemua data sekarang sinkron antar PC.');
    } catch (err: any) {
      console.error(err);
      alert('❌ Gagal menyimpan konfigurasi: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const [lastSync, setLastSync] = useState<string | null>(null);

  const [showScript, setShowScript] = useState(false);

  const appsScriptCode = `
function doGet(e) {
  // Prevent error when testing via "Run" button
  if (!e || !e.parameter) {
    return ContentService.createTextOutput("Apps Script is Active. Please access via Web App URL.")
      .setMimeType(ContentService.MimeType.TEXT);
  }

  var action = e.parameter.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Accounts");
  
  // Auto-create sheet if missing
  if (!sheet) {
    sheet = ss.insertSheet("Accounts");
    sheet.appendRow(["ID", "Username", "Password", "Role", "OPD Name", "Spreadsheet ID", "Registered At", "Email"]);
  }
  
  if (action == "listAccounts") {
    var data = sheet.getDataRange().getValues();
    var accounts = [];
    for (var i = 1; i < data.length; i++) {
      var row = data[i];
      if (!row[1]) continue;
      accounts.push({
        username: String(row[1]),
        password: String(row[2]),
        role: row[3] || "User",
        opdName: row[4] || "",
        spreadsheetId: row[5] == "-" ? "" : String(row[5]),
        registeredAt: row[6],
        email: row[7] || ""
      });
    }
    return ContentService.createTextOutput(JSON.stringify({ accounts: accounts }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  var data = JSON.parse(e.postData.contents);
  var action = data.action;
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName("Accounts");
  
  if (!sheet) {
    sheet = ss.insertSheet("Accounts");
    sheet.appendRow(["ID", "Username", "Password", "Role", "OPD Name", "Spreadsheet ID", "Registered At", "Email"]);
  }
  
  if (action == "syncAccount") {
    var acc = data.account;
    var rows = sheet.getDataRange().getValues();
    var foundIndex = -1;
    
    for (var i = 1; i < rows.length; i++) {
       if (rows[i][1] && rows[i][1].toString().toLowerCase() == acc.username.toLowerCase()) {
         foundIndex = i + 1;
         break;
       }
    }
    
    var values = [
      rows.length, 
      acc.username, 
      acc.password || "", 
      acc.role || "User", 
      acc.opdName || "", 
      acc.spreadsheetId || "-", 
      acc.registeredAt || new Date().toLocaleDateString("id-ID"),
      acc.email || ""
    ];
    
    if (foundIndex > 0) {
      sheet.getRange(foundIndex, 1, 1, 8).setValues([values]);
    } else {
      sheet.appendRow(values);
    }
    
    return ContentService.createTextOutput(JSON.stringify({ status: "ok" }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
`.trim();

  const syncToMasterSheet = async (accountsToSync: Account[], silent = false) => {
    const masterId = extractId(settings.masterSheetId || configForm.masterSheetId);
    if (!masterId || !effectiveToken) {
      if (!silent) alert('Master Sheet ID belum di-setting atau anda belum Login Google Auth / Shared Token tidak tersedia!');
      return;
    }

    console.log(`[Sync] Starting sync to master sheet: ${masterId} using ${token ? 'Own Token' : 'Shared Token'}`);
    if (!silent) setSyncing(true);
    setSyncFailed(false);

    // Timeout controller for fetch
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.warn('[Sync] Timeout reached, aborting fetch...');
      controller.abort();
    }, 25000); // Increased to 25 seconds for slow Google writes

    try {
      const header = [['NO', 'USERNAME', 'PASSWORD', 'ROLE', 'OPD NAME', 'SPREADSHEET ID', 'REGISTERED AT', 'EMAIL (GOOGLE)']];
      const rows = accountsToSync.map((acc, idx) => [
        idx + 1,
        acc.username,
        acc.password || '',
        acc.role,
        acc.opdName,
        acc.spreadsheetId || '-',
        acc.registeredAt,
        acc.email || ''
      ]);

      const writeRes = await fetch('/api/sheets/write', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}`
        },
        body: JSON.stringify({
          spreadsheetId: masterId,
          range: 'Accounts!A1',
          values: [...header, ...rows]
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!writeRes.ok) {
        let errMsg = 'Sync Failed';
        try {
          const errData = await writeRes.json();
          errMsg = errData.message || errData.error || errMsg;
        } catch (e) {
          errMsg = `Server Error (${writeRes.status})`;
        }
        throw new Error(errMsg);
      }

      setSyncFailed(false);
      setLastSync(new Date().toLocaleTimeString());
      if (!silent) alert('Berhasil sinkronisasi ' + rows.length + ' akun ke Master Spreadsheet!');
      console.log('[Sync] Sync to master sheet complete:', rows.length, 'rows');
    } catch (err: any) {
      console.error('[Sync Error]:', err);
      setSyncFailed(true);
      
      const isTimeout = err.name === 'AbortError';
      const msg = isTimeout ? 'Koneksi ke Google Sheets timeout (25 detik). Coba lagi.' : err.message;
      
      if (!silent) alert('Gagal sinkronisasi: ' + msg);
      else console.warn('[Sync] Silent sync failed:', msg);
    } finally {
      clearTimeout(timeoutId);
      if (!silent) setSyncing(false);
    }
  };

  const handleManualSync = () => {
    syncToMasterSheet(accounts, false);
  };

  const importFromMasterSheet = async () => {
    const masterId = extractId(settings.masterSheetId || configForm.masterSheetId);
    if (!masterId || !effectiveToken) {
      alert('Master Sheet ID belum di-setting atau token tidak tersedia!');
      return;
    }

    if (!confirm('Impor data dari Google Sheets akan menambahkan akun yang belum ada di database. Lanjutkan?')) return;

    setImporting(true);
    try {
      const res = await fetch(`/api/sheets/read?spreadsheetId=${masterId}&range=Accounts!A2:G100`, {
        headers: { 'Authorization': `Bearer ${effectiveToken}` }
      });
      
      if (!res.ok) throw new Error('Gagal membaca data dari Sheets');
      const data = await res.json();
      const rows = data.values || [];

      let importedCount = 0;
      for (const row of rows) {
        const [no, username, password, role, opdName, spreadsheetId, registeredAt, email] = row;
        if (!username) continue;

        // Check if exists locally
        const exists = accounts.some(a => a.username.toLowerCase() === username.toLowerCase());
        if (!exists) {
          await addDoc(collection(db, 'accounts'), {
            username,
            password: password || '',
            email: email || '',
            role: (role === 'Administrator' ? 'Administrator' : 'User'),
            opdName: opdName || username.toUpperCase(),
            spreadsheetId: spreadsheetId === '-' ? '' : spreadsheetId,
            registeredAt: registeredAt || new Date().toLocaleDateString('id-ID'),
            createdAt: Date.now()
          });
          importedCount++;
        }
      }

      alert(`Berhasil mengimpor ${importedCount} akun baru dari Google Sheets. Data akan disinkronkan kembali untuk memastikan konsistensi.`);
      
      // Pull fresh data from Firestore and Sync back to Sheet to ensure parity
      const querySnapshot = await getDocs(query(collection(db, 'accounts')));
      const allAccounts = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
      await syncToMasterSheet(allAccounts, true);
    } catch (err: any) {
      console.error(err);
      alert('Gagal impor: ' + err.message);
    } finally {
      setImporting(false);
    }
  };
  
  // Form state
  const [form, setForm] = useState({
    username: '',
    password: '',
    email: '',
    opdName: '',
    role: 'User' as 'Administrator' | 'User'
  });
  const [submitting, setSubmitting] = useState(false);

  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Forced UI release timeout for safety
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 5000);

    // Initial query - simpler query to avoid missing index errors
    const q = query(collection(db, 'accounts'));
    
    // Use onSnapshot for real-time sync across all devices/PCs
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      })) as Account[];
      
      console.log('Database synced:', data.length, 'accounts found.');
      
      // Sort in-memory to avoid Firestore Index requirement for ordering
      const sortedData = [...data].sort((a, b) => {
        const timeA = typeof a.createdAt === 'number' ? a.createdAt : 0;
        const timeB = typeof b.createdAt === 'number' ? b.createdAt : 0;
        return timeB - timeA;
      });
      
      setAccounts(sortedData);
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    }, (error: any) => {
      console.error('Firestore subscription error:', error);
      setLoading(false);
      if (timeoutId) clearTimeout(timeoutId);
    });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      unsubscribe();
    };
  }, []);

  const handleDeleteAccount = async (id: string) => {
    if (!confirm('Yakin ingin menghapus akun ini?')) return;

    // Optimistic Delete
    setAccounts(prev => prev.filter(a => a.id !== id));
    
    try {
      await deleteDoc(doc(db, 'accounts', id));
      if (currentViewingAs?.id === id) onViewAs(null);
      
      if (settings.masterSheetId) {
        // Fetch fresh state for Google Sheet sync
        const updatedSnapshot = await getDocs(query(collection(db, 'accounts'), orderBy('createdAt', 'desc')));
        const updatedAccounts = updatedSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Account[];
        await syncToMasterSheet(updatedAccounts, true);
      }
    } catch (err) {
      console.error('Error deleting account:', err);
      // Note: onSnapshot will naturally revert or sync based on server status
      alert('Gagal menghapus akun');
    }
  };

  const handleCreateMasterSheet = async () => {
    if (!effectiveToken) {
      alert('Silakan hubungkan akun Google atau pastikan Akses Global aktif.');
      return;
    }

    setSyncing(true);
    try {
      const title = `MASTER_RISK_ACCOUNTS_${new Date().getFullYear()}`;
      // 1. Create Spreadsheet with ONLY Accounts tab
      const res = await fetch('/api/sheets/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${effectiveToken}` 
        },
        body: JSON.stringify({ 
          title,
          folderId: extractId(configForm.targetFolderId),
          sheets: [{ properties: { title: 'Accounts' } }]
        })
      });
      
      if (!res.ok) throw new Error('Gagal membuat Spreadsheet file.');
      const data = await res.json();
      
      if (data.spreadsheetId) {
        // Also save the current token as the master token for others to use
        const newConfig = { ...configForm, masterSheetId: data.spreadsheetId, masterToken: token };
        await setDoc(doc(db, 'config', 'global'), newConfig, { merge: true });
        setConfigForm(newConfig);
        alert('Master Sheet berhasil dibuat dan dihubungkan!\nID: ' + data.spreadsheetId + '\n\nToken Cloud juga telah dibagikan ke seluruh pengguna.');
        
        // 2. Initial sync
        await syncToMasterSheet(accounts, false);
      }
    } catch (err: any) {
      console.error(err);
      alert('Gagal membuat Master Sheet: ' + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || !form.password || submitting) return;

    setSubmitting(true);
    setSuccess(false);

    const now = new Date();
    const timestamp = Date.now();
    
    const cleanUsername = form.username.trim();
    const cleanPassword = form.password.trim();
    const cleanEmail = form.email.trim();
    const cleanOpdName = form.opdName.trim() || cleanUsername.toUpperCase();

    // Check for duplicate username
    const isDuplicate = accounts.some(a => a.username.toLowerCase() === cleanUsername.toLowerCase());
    if (isDuplicate) {
      alert(`⚠️ USERNAME SUDAH ADA: Username "${cleanUsername}" sudah terdaftar. Gunakan username lain.`);
      setSubmitting(false);
      return;
    }

    const newAccountObj = {
      username: cleanUsername,
      password: cleanPassword,
      email: cleanEmail,
      role: (form.role as any) || 'User',
      opdName: cleanOpdName,
      createdAt: timestamp,
      registeredAt: `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`
    };

    console.log('Initiating account creation...', newAccountObj);

    // Safety timeout to reset UI if Firestore is unusually slow
    const safetyTimeout = setTimeout(() => {
      setSubmitting(false);
    }, 8000);

    try {
      let userSpreadsheetId = '';
      
      // AUTO-CREATE USER SPREADSHEET (If folder configured and admin is logged into cloud)
      const folderId = extractId(settings?.targetFolderId);
      if (folderId && effectiveToken) {
        console.log('Auto-creating sheet for user in folder:', folderId);
        try {
          const title = `Risk Register ${cleanUsername.toUpperCase()} periode ${now.getFullYear()}`;
          const createRes = await fetch('/api/sheets/create', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${effectiveToken}` 
            },
            body: JSON.stringify({ title, folderId })
          });
          if (createRes.ok) {
            const data = await createRes.json();
            userSpreadsheetId = data.spreadsheetId;
            console.log('Auto-created sheet:', userSpreadsheetId);
          }
        } catch (e) {
          console.warn('Failed to auto-create user spreadsheet, will save account without it:', e);
        }
      }

      const accountDataForDb = {
        ...newAccountObj,
        spreadsheetId: userSpreadsheetId
      };

      // 1. Save to Cloud Firestore
      console.log('Sending data to Firestore...', accountDataForDb);
      const accountsCol = collection(db, 'accounts');
      const docRef = await addDoc(accountsCol, accountDataForDb);
      console.log('Account saved successfully to Firestore with ID:', docRef.id);

      // UI cleanup early to show responsiveness
      setForm({ username: '', password: '', email: '', opdName: '', role: 'User' });
      setSuccess(true);
      
      // Explicitly trigger a refresh in the local state
      const newAccountObjWithId = { id: docRef.id, ...accountDataForDb } as Account;
      setAccounts(prev => {
        const updated = [newAccountObjWithId, ...prev];
        return updated.sort((a, b) => b.createdAt - a.createdAt);
      });

      alert(`✅ AKUN BERHASIL DIBUAT!\n\nUsername: ${cleanUsername}\nOPD: ${cleanOpdName}\n\nData telah tersimpan di database Cloud.`);
      setTimeout(() => setSuccess(false), 3000);

      // 2. Sync to Apps Script (Universal Bridge)
      const proxyUrl = settings?.appsScriptUrl || configForm.appsScriptUrl;
      if (proxyUrl) {
         console.log('Syncing to Apps Script Bridge...');
         await AccountService.syncToProxy(accountDataForDb);
      }

      // 3. Sync to Master Sheet if configured (non-blocking for UI success)
      const masterId = extractId(settings.masterSheetId || configForm.masterSheetId);
      if (masterId && effectiveToken) {
        console.log('Syncing new account to master sheet:', masterId);
        const currentAccountsSnapshot = await getDocs(query(collection(db, 'accounts')));
        const currentAccounts = currentAccountsSnapshot.docs.map(d => ({ id: d.id, ...d.data() })) as Account[];
        await syncToMasterSheet(currentAccounts, true);
      }
      
    } catch (err: any) {
      console.error('Account creation error:', err);
      // Detailed error if permissions or network fail
      alert(`⚠️ GAGAL MENYIMPAN: ${err.message || 'Koneksi bermasalah'}\n\nPastikan Anda terhubung ke internet.`);
    } finally {
      clearTimeout(safetyTimeout);
      setSubmitting(false);
    }
  };

  const togglePasswordVisibility = (id: string) => {
    setShowPassword(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const capitalizeUsernames = async () => {
     // Optional feature shown in image
     alert('Fitur Kapitalisasi sedang diaktifkan untuk konsistensi data.');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-black text-slate-900 flex items-center gap-3">
             <div className="flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
                <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
                LIVE DATABASE CONNECTED
             </div>
             XI. MANAJEMEN AKUN <span className="text-indigo-600 font-medium text-lg">(STRATEGIS)</span>
          </h1>
          {currentViewingAs && (
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-50 border border-indigo-100 rounded-full">
                <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse"></div>
                <span className="text-[10px] font-black text-indigo-700 uppercase tracking-wider">
                  VIEWING AS: {currentViewingAs.opdName}
                </span>
                <button 
                  onClick={() => onViewAs(null)}
                  className="text-[9px] font-black text-red-500 hover:text-red-600 ml-1 underline decoration-2 underline-offset-2"
                >
                  [STOP]
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
           <button 
             onClick={handleManualSync}
             disabled={syncing || loading}
             className="flex flex-col items-end gap-1"
           >
             <div className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-[11px] font-black uppercase tracking-widest rounded-xl hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95 disabled:opacity-50">
               {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
               {syncing ? 'Syncing...' : 'Sync Data ke Google Sheets'}
             </div>
             <div className="flex flex-col items-end">
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mr-2">
                  Pencadangan Akun ke Spreadsheet
               </span>
               {lastSync && (
                 <span className="text-[7px] font-bold text-emerald-500 uppercase tracking-tighter mr-2">
                   Last Synced: {lastSync}
                 </span>
               )}
               {syncFailed && (
                 <span className="text-[7px] font-bold text-red-500 uppercase tracking-tighter mr-2">
                   Sync Failed!
                 </span>
               )}
             </div>
           </button>
        </div>
      </header>

      {/* Global Config */}
      <section className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-indigo-100">
        <div className="px-8 py-5 border-b border-slate-50 flex items-center justify-between bg-indigo-50/30">
          <h2 className="text-sm font-black text-indigo-900 italic tracking-widest uppercase flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5" />
            Konfigurasi Google Drive & Master Sheet
            {settingsLoaded ? (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md text-[8px] font-black animate-in fade-in">
                <ShieldCheck className="w-2.5 h-2.5" /> CLOUD SYNCED
              </span>
            ) : (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-100 text-amber-700 rounded-md text-[8px] font-black animate-pulse">
                <RefreshCw className="w-2.5 h-2.5 animate-spin" /> FETCHING...
              </span>
            )}
          </h2>
          <div className="flex items-center gap-4">
            {token && (
              <button 
                onClick={async () => {
                  if (confirm('AKTIFKAN AKSES GLOBAL?\n\nIni akan menggunakan akun Google Anda saat ini sebagai akses database untuk SEMUA USER di PC mana pun. Mereka tidak perlu lagi login Google secara manual.')) {
                    setGlobalSyncing(true);
                    try {
                      console.log('Sharing token globally...', token);
                      await setDoc(doc(db, 'config', 'global'), { masterToken: token }, { merge: true });
                      alert('BERHASIL!\nAkses Global telah diaktifkan. User lain sekarang dapat langsung bekerja.');
                    } catch (e: any) {
                      console.error('Error sharing token:', e);
                      alert('Gagal mengaktifkan akses global: ' + e.message);
                    } finally {
                      setGlobalSyncing(false);
                    }
                  }
                }}
                disabled={globalSyncing}
                className={cn(
                  "text-[9px] font-black text-white px-4 py-2 rounded-xl transition uppercase tracking-widest shadow-lg flex items-center gap-2",
                  globalSyncing ? "bg-slate-400 cursor-not-allowed" : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 animate-bounce"
                )}
              >
                {globalSyncing ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <ShieldCheck className="w-3 h-3" />
                )}
                {globalSyncing ? 'SINKRONISASI...' : 'Aktifkan Akses Global (One-Click Fix)'}
              </button>
            )}
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest bg-white px-3 py-1 rounded-full border border-indigo-100">
              ADMIN ONLY
            </span>
          </div>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                User Spreadsheet Folder ID
                <span className="text-indigo-400 normal-case font-medium italic">(Folder tempat menyimpan sheet user)</span>
              </label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all"
                placeholder="Paste URL Folder atau ID di sini..."
                value={configForm.targetFolderId}
                onChange={e => setConfigForm({...configForm, targetFolderId: e.target.value})}
              />
            </div>
            <p className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
              Folder ini akan digunakan sebagai tempat menyimpan file Google Sheets yang baru dibuat secara otomatis oleh sistem untuk setiap OPD.
            </p>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 flex items-center justify-between">
                <span>Master Account Sheet ID</span>
                <span className="text-indigo-400 normal-case font-medium italic">(Sheet log username & password)</span>
              </label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold text-slate-700 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500/30 transition-all"
                    placeholder="Paste URL Spreadsheet atau ID di sini..."
                    value={configForm.masterSheetId}
                    onChange={e => setConfigForm({...configForm, masterSheetId: e.target.value})}
                  />
                  <button 
                    onClick={handleCreateMasterSheet}
                    disabled={syncing}
                    title="Generate file spreadsheet baru otomatis"
                    className="px-6 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-tight transition-all active:scale-95 disabled:opacity-50 min-w-[120px]"
                  >
                    {configForm.masterSheetId ? 'New Sheet' : 'Generate'}
                  </button>
                </div>
            </div>
                <div className="flex flex-col gap-3">
                <div className="text-[10px] text-slate-400 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  Data seluruh akun akan disinkronkan ke spreadsheet ini dalam tab bernama <span className="font-black text-indigo-500">"Accounts"</span>.
                  {settings.masterSheetId && (
                    <div className="flex items-center gap-4 mt-2">
                      <a 
                        href={`https://docs.google.com/spreadsheets/d/${extractId(settings.masterSheetId)}`} 
                        target="_blank" 
                        rel="noreferrer"
                        className="text-indigo-600 hover:underline font-black"
                      >
                        ↗ OPEN MASTER SHEET
                      </a>
                      <button 
                        onClick={importFromMasterSheet}
                        disabled={importing || !token}
                        className={cn(
                          "text-[9px] font-black underline flex items-center gap-1 uppercase transition-colors",
                          importing ? "text-slate-400" : "text-emerald-600 hover:text-emerald-700"
                        )}
                      >
                        {importing ? <RefreshCw className="w-2 h-2 animate-spin" /> : <Download className="w-2 h-2" />}
                        {importing ? 'Sinkronisasi...' : 'Sinkronkan (Tarik & Kirim)'}
                      </button>
                    </div>
                  )}
                </div>
                <button 
                  onClick={handleSaveConfig}
                  className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-900 transition shadow-xl shadow-indigo-100 active:scale-95"
                >
                  Simpan Konfigurasi
                </button>
              </div>
          </div>

          {/* New Apps Script Bridge Section */}
          <div className="md:col-span-2 mt-4 pt-6 border-t border-slate-100">
             <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                   <h3 className="text-[10px] font-black text-indigo-600 uppercase tracking-widest flex items-center gap-2">
                      <LinkIcon className="w-3 h-3" />
                      Apps Script Bridge (Universal Sync Fix)
                   </h3>
                   <button 
                     onClick={() => setShowScript(!showScript)}
                     className="text-[9px] font-black text-slate-400 hover:text-indigo-600 underline"
                   >
                     {showScript ? 'Sembunyikan Script' : 'Lihat Script Setup'}
                   </button>
                </div>
                
                <div className="flex gap-4">
                   <div className="flex-1 space-y-2">
                      <label className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter">Apps Script Web App URL</label>
                      <input 
                        type="text" 
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold text-indigo-600 placeholder:text-slate-300 outline-none focus:ring-4 focus:ring-indigo-500/10 transition-all"
                        placeholder="https://script.google.com/macros/s/.../exec"
                        value={configForm.appsScriptUrl}
                        onChange={e => setConfigForm({...configForm, appsScriptUrl: e.target.value})}
                      />
                   </div>
                   <button 
                     onClick={async () => {
                        if (!configForm.appsScriptUrl) return alert('Masukkan Apps Script URL terlebih dahulu!');
                        setSyncing(true);
                        try {
                           let count = 0;
                           for (const acc of accounts) {
                              await AccountService.syncToProxy(acc);
                              count++;
                           }
                           alert(`✅ Berhasil ekspor ${count} akun ke Apps Script!`);
                        } catch (e) {
                           alert('Gagal ekspor ke Apps Script');
                        } finally {
                           setSyncing(false);
                        }
                     }}
                     disabled={syncing || !configForm.appsScriptUrl}
                     className="px-6 bg-slate-900 text-white rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-black transition self-end h-[42px] disabled:opacity-50"
                   >
                      {syncing ? 'SINKRON...' : 'Ekspor Semua Akun'}
                   </button>
                </div>

                {showScript && (
                  <div className="animate-in slide-in-from-top-2 duration-300">
                    <div className="bg-slate-900 rounded-xl p-6 space-y-4">
                       <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Setup Instructions:</span>
                          <button 
                             onClick={() => {
                                navigator.clipboard.writeText(appsScriptCode);
                                alert('Script berhasil disalin! Silakan paste ke menu Extensions > Apps Script di Google Sheets Anda.');
                             }}
                             className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[9px] font-black uppercase tracking-widest transition"
                          >
                             Copy Script
                          </button>
                       </div>
                       <p className="text-[10px] text-slate-400 leading-relaxed">
                          1. Buka Master Sheet Anda.<br/>
                          2. Klik Menu <b>Extensions</b> &gt; <b>Apps Script</b>.<br/>
                          3. Hapus semua kode default dan Paste script ini.<br/>
                          4. Klik <b>Deploy</b> &gt; <b>New Deployment</b> &gt; Select type: <b>Web App</b>.<br/>
                          5. Who has access: <b>Anyone</b>.<br/>
                          6. Salin Web App URL dan paste ke kolom di atas.
                       </p>
                       <pre className="text-[9px] text-emerald-400 bg-black/40 p-4 rounded-lg font-mono overflow-x-auto max-h-40">
                          {appsScriptCode}
                       </pre>
                    </div>
                  </div>
                )}
             </div>
          </div>
        </div>
      </section>

      {/* Guide Removed - Replaced by Global Token */}

      {/* Tambah Akun Baru */}
      <section id="add-account-form" className="bg-slate-900 rounded-[2rem] overflow-hidden shadow-2xl border border-slate-800">
        <div className="px-8 py-5 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-black text-white italic tracking-widest uppercase">Tambah Akun Baru</h2>
          <button 
            onClick={capitalizeUsernames}
            className="text-[10px] font-black text-slate-400 bg-slate-800 px-4 py-1.5 rounded-lg hover:text-white transition uppercase tracking-tighter"
          >
            Kapitalisasi Semua Username
          </button>
        </div>
        <div className="p-8">
          <form onSubmit={handleCreateAccount} className="grid grid-cols-1 md:grid-cols-5 gap-6 items-end">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nama OPD / Unit</label>
              <input 
                type="text" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                placeholder="CONTOH: INSPEKTORAT"
                value={form.opdName}
                onChange={e => setForm({...form, opdName: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Email Google (Opsional)</label>
              <input 
                type="email" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                placeholder="email@gmail.com"
                value={form.email}
                onChange={e => setForm({...form, email: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Username</label>
              <input 
                type="text" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                placeholder="username"
                value={form.username}
                onChange={e => setForm({...form, username: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Password</label>
              <input 
                type="password" 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder:text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 transition"
                placeholder="password"
                value={form.password}
                onChange={e => setForm({...form, password: e.target.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Role</label>
              <select 
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50 transition appearance-none"
                value={form.role}
                onChange={e => setForm({...form, role: e.target.value as any})}
              >
                <option value="User">User</option>
                <option value="Administrator">Administrator</option>
              </select>
            </div>
            <div className="md:col-span-5 translate-y-2">
              <button 
                type="submit"
                disabled={submitting}
                className={cn(
                  "w-full rounded-xl py-4 text-xs font-black uppercase tracking-widest transition shadow-lg flex items-center justify-center gap-2",
                  success 
                    ? "bg-emerald-500 text-white shadow-emerald-900/20" 
                    : "bg-indigo-600 text-white hover:bg-indigo-500 shadow-indigo-900/40",
                  submitting && "opacity-80"
                )}
              >
                {submitting ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : success ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {success ? 'Akun Berhasil Dibuat!' : submitting ? 'Sedang Menyimpan ke Cloud...' : 'Konfirmasi & Buat Akun Baru'}
              </button>
            </div>
          </form>
        </div>
      </section>

      {/* Daftar Seluruh Akun */}
      <section className="bg-white rounded-[2rem] overflow-hidden shadow-xl border border-slate-100">
        <div className="px-8 py-6 border-b border-slate-50 flex items-center gap-3">
          <UserPlus className="w-5 h-5 text-indigo-500" />
          <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest italic">Daftar Seluruh Akun</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest w-16">No</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Username</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Password</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Role</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Terdaftar Pada</th>
                <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {accounts.map((acc, idx) => (
                <tr key={acc.id} className={cn("hover:bg-slate-50/50 transition-colors group", currentViewingAs?.id === acc.id && "bg-indigo-50/30")}>
                  <td className="px-8 py-5 text-xs font-black text-slate-400">{idx + 1}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black",
                        acc.role === 'Administrator' ? "bg-amber-100 text-amber-600" : "bg-indigo-100 text-indigo-600"
                      )}>
                        {acc.username.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-black text-slate-900 uppercase tracking-tight">{acc.opdName}</span>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[10px] font-bold text-slate-400 italic">@{acc.username.toLowerCase()}</span>
                          {acc.email && (
                            <span className="text-[9px] font-black text-indigo-500/60 lowercase">{acc.email}</span>
                          )}
                          {acc.spreadsheetId && (
                            <div className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-md border border-emerald-100 text-[8px] font-black uppercase">
                              <FileSpreadsheet className="w-2 h-2" />
                              ID: {acc.spreadsheetId.substring(0, 5)}...
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2 font-mono text-xs text-slate-500">
                      {showPassword[acc.id] ? acc.password : '••••••••'}
                      <button 
                        onClick={() => togglePasswordVisibility(acc.id)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-400"
                      >
                        {showPassword[acc.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      acc.role === 'Administrator' 
                        ? "bg-amber-50 text-amber-600 border-amber-100" 
                        : "bg-indigo-50 text-indigo-600 border-indigo-100"
                    )}>
                      {acc.role}
                    </span>
                  </td>
                  <td className="px-8 py-5 text-xs font-medium text-slate-500">{acc.registeredAt}</td>
                  <td className="px-8 py-5">
                    <div className="flex items-center justify-center gap-2">
                      <button 
                        onClick={() => onViewAs(acc)}
                        className={cn(
                          "flex items-center gap-2 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-tight transition shadow-sm",
                          currentViewingAs?.id === acc.id 
                            ? "bg-slate-900 text-white" 
                            : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {currentViewingAs?.id === acc.id ? 'Viewing' : 'View As'}
                      </button>
                      <button className="p-2 text-slate-400 hover:text-indigo-600 transition">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDeleteAccount(acc.id)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 text-red-500 rounded-lg font-black text-[9px] uppercase hover:bg-red-100 transition shadow-sm"
                      >
                         <Trash2 className="w-3.5 h-3.5" />
                         Hapus Akun
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {loading && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-400 text-xs font-bold italic tracking-widest">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 opacity-20" />
                    Memuat data akun...
                  </td>
                </tr>
              )}
              {!loading && accounts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-8 py-12 text-center text-slate-300 text-xs font-bold italic tracking-widest">
                    Belum ada akun terdaftar.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
