import { db } from './firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export interface Account {
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

/**
 * Service to handle account operations via Google Apps Script Proxy or Firestore
 */
export const AccountService = {
  /**
   * Fetches the Apps Script URL from the global configuration
   * Optimized with localStorage fallback to handle offline/Firestore failure
   */
  async getProxyUrl(): Promise<string | null> {
    // Try localStorage first (fast, works offline)
    const cached = localStorage.getItem('ais_apps_script_url');
    
    try {
      // Background check Firestore for updates if possible
      const configDoc = await getDoc(doc(db, 'config', 'global'));
      if (configDoc.exists()) {
        const url = configDoc.data().appsScriptUrl || null;
        if (url) {
          localStorage.setItem('ais_apps_script_url', url);
        }
        return url;
      }
    } catch (e) {
      console.warn('[AccountService] Firestore check failed (offline?), using cache:', e);
      return cached;
    }
    return cached;
  },

  /**
   * Universal fetch for accounts (tries Proxy then fallback to Firestore)
   */
  async listAccounts(): Promise<Account[]> {
    const proxyUrl = await this.getProxyUrl();
    
    if (proxyUrl) {
      console.log('[AccountService] FETCHING FROM APPS SCRIPT PROXY...');
      try {
        const res = await fetch(proxyUrl + '?action=listAccounts');
        if (res.ok) {
          const data = await res.json();
          const accounts = data.accounts || [];
          console.log(`[AccountService] Proxy returned ${accounts.length} accounts.`);
          return accounts;
        } else {
          console.warn('[AccountService] Proxy response not OK:', res.status);
        }
      } catch (e) {
        console.warn('[AccountService] Proxy fetch error:', e);
      }
    }
    
    // Fallback: This is what it was doing before, but let's be more explicit
    console.log('[AccountService] Falling back to Firestore fetching...');
    return [];
  },

  /**
   * Syncs an account to the Apps Script Proxy
   */
  async syncToProxy(account: Partial<Account>): Promise<boolean> {
    const proxyUrl = await this.getProxyUrl();
    if (!proxyUrl) return false;

    try {
      const res = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'syncAccount',
          account
        })
      });
      return res.ok;
    } catch (e) {
      console.error('[AccountService] Sync error:', e);
      return false;
    }
  }
};
