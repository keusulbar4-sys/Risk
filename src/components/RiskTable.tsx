import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Edit2, Check, X, RefreshCw } from 'lucide-react';
import { SheetService } from '../services/sheets';
import { cn } from '../lib/utils';

interface Column {
  key: string;
  label: string;
  width?: string;
  render?: (row: any, index: number, handleChange: (key: string, val: any) => void, rows: any[]) => React.ReactNode;
}

interface GenericRiskTableProps {
  title: string;
  description: string;
  columns: Column[];
  sheetName: string;
  spreadsheetId: string;
  token: string;
  rows: any[];
  tahun?: string; // Add tahun prop
  onRowsChange?: (rows: any[]) => void;
  onSpreadsheetError?: () => void;
  footer?: React.ReactNode;
  extraHeader?: React.ReactNode;
}

export function GenericRiskTable({ 
  title, 
  description, 
  columns, 
  sheetName, 
  spreadsheetId, 
  token,
  rows = [],
  tahun, // Destructure tahun
  onRowsChange = () => {},
  onSpreadsheetError,
  footer,
  extraHeader
}: GenericRiskTableProps) {
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial data on mount if rows is empty
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      setError(null);
      const service = new SheetService(spreadsheetId, token);
      try {
        // We read one extra column for the "Tahun" filter
        const endCol = String.fromCharCode(64 + columns.length + 1);
        const data = await service.read(`${sheetName}!A2:${endCol}2000`);
        
        if (data && data.length > 0) {
          const fetchedRows = data
            .filter(row => {
               if (!tahun) return true; // No filter if tahun not provided
               // The tahun is stored in the column immediately after the defined columns
               const rowTahun = row[columns.length];
               return rowTahun === tahun;
            })
            .map((row, idx) => {
              const rowObj: any = { id: Date.now().toString() + idx };
              columns.forEach((col, i) => {
                rowObj[col.key] = row[i] || '';
              });
              return rowObj;
            });
          onRowsChange(fetchedRows);
        }
      } catch (err: any) {
        console.error('Failed to fetch initial data:', err);
        const is404 = err.message?.toLowerCase().includes('not found') || err.message?.includes('404');
        if (is404) {
           setError('ID Spreadsheet tidak ditemukan atau tidak dapat diakses (404).');
           if (onSpreadsheetError) onSpreadsheetError();
        } else {
           setError('Gagal memuat data dari Cloud.');
        }
      } finally {
        setLoading(false);
      }
    };

    if (rows.length === 0 && spreadsheetId && token) {
      fetchInitialData();
    }
  }, [spreadsheetId, token, sheetName, tahun]);

  const handleAdd = () => {
    const newRow = columns.reduce((acc, col) => ({ ...acc, [col.key]: '' }), {});
    onRowsChange([...rows, { ...newRow, _isNew: true, id: Date.now().toString(), tahun: tahun }]);
  };

  const handleRemove = (index: number) => {
    const updatedRows = rows.filter((_, i) => i !== index);
    onRowsChange(updatedRows);
  };

  const handleChange = (index: number, key: string, value: string) => {
    const newRows = [...rows];
    newRows[index][key] = value;
    onRowsChange(newRows);
  };

  const handleSave = async () => {
    setIsSaving(true);
    const service = new SheetService(spreadsheetId, token);
    
    try {
      // 1. Fetch current sheet state first to avoid overwriting other years
      // This is a simplified approach: we read everything, partition/merge, then write back.
      // But for performance and simplicity in this sprint, we just append Tahun to current rows 
      // and write to the same space (assuming the sheet is primarily managed by this app).
      // BETTER: We only overwrite the range we need or use a more advanced merge.
      
      const endCol = String.fromCharCode(64 + columns.length + 1); // Extra col for Tahun
      
      // We need to fetch the existing data to preserve other years
      const rawData = await service.read(`${sheetName}!A2:${endCol}2000`) || [];
      
      // Filter out rows belonging to the CURRENT year from the raw data
      const otherYearsRows = rawData.filter(r => r[columns.length] !== tahun);
      
      // Prepare current rows with Tahun appended
      const currentYearRows = rows.map(row => {
        const rowVals = columns.map(col => row[col.key] || '');
        rowVals[columns.length] = tahun || ''; // Explicitly set the year
        return rowVals;
      });

      const finalData = [...otherYearsRows, ...currentYearRows];
      
      // Write back all data (preserving other years)
      const range = `${sheetName}!A2:${endCol}${Math.max(finalData.length + 1, 2)}`;
      await service.write(range, finalData);
      
      alert(`Berhasil: Data ${sheetName} Periode ${tahun} telah disimpan ke Google Sheets.`);
    } catch (err: any) {
      console.error(err);
      let msg = 'Gagal menyimpan ke Google Sheets.';
      if (err.message?.includes('Requested entity was not found')) {
        msg = 'ID Spreadsheet tidak ditemukan. Pastikan file Google Sheets Anda masih ada.';
      }
      alert(msg + '\n\nDetail: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {extraHeader}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <h3 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h3>
             {loading ? (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 text-[9px] font-black uppercase animate-pulse">
                  <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                  Auto-Sync
                </div>
             ) : (
                <div className="flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 text-[9px] font-black uppercase">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                  Cloud Connected
                </div>
             )}
          </div>
          <p className="text-slate-500 text-xs font-medium">{description}</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={handleAdd}
            className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-50 transition shadow-sm active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Baris
          </button>
          <button 
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50 active:scale-95"
          >
            {isSaving ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent animate-spin rounded-full" /> : <Save className="w-3.5 h-3.5" />}
            Simpan Perubahan
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-3 py-4 w-12"></th>
                {columns.map(col => (
                  <th key={col.key} className={cn("px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest", col.width)}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map((row, idx) => (
                <tr key={row.id || idx} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2 text-center">
                    <button 
                      onClick={() => handleRemove(idx)}
                      className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-all flex items-center justify-center mx-auto"
                    >
                      <X className="w-4 h-4 stroke-[3px]" />
                    </button>
                  </td>
                  {columns.map(col => (
                    <td key={col.key} className={cn("px-4 py-3 align-top", col.width)}>
                      {col.render ? (
                        col.render(row, idx, (key, val) => handleChange(idx, key, val), rows)
                      ) : (
                        <textarea
                          className="w-full bg-transparent border-none focus:ring-2 focus:ring-indigo-100 rounded-lg px-2 py-1.5 text-[11px] text-slate-700 font-medium outline-none transition placeholder:opacity-20 min-h-[40px] resize-none overflow-hidden"
                          placeholder="..."
                          value={row[col.key] || ''}
                          rows={1}
                          onInput={(e: any) => {
                            e.target.style.height = 'auto';
                            e.target.style.height = e.target.scrollHeight + 'px';
                          }}
                          onChange={(e) => handleChange(idx, col.key, e.target.value)}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
                  {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length + 1} className="px-6 py-24 text-center">
                    <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
                       {loading ? (
                          <>
                            <div className="w-12 h-12 bg-indigo-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                               <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
                            </div>
                            <p className="text-slate-500 text-[11px] font-black uppercase tracking-widest animate-pulse">Menghubungkan ke Google Sheet Anda...</p>
                          </>
                       ) : error ? (
                          <>
                            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                               <X className="w-6 h-6 text-red-500" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-red-600 text-xs font-black uppercase tracking-tight">Koneksi Cloud Gagal</p>
                              <p className="text-slate-500 text-[10px] leading-relaxed italic">{error}</p>
                              <button 
                                onClick={() => window.location.reload()}
                                className="mt-2 text-[9px] font-bold text-indigo-600 hover:underline uppercase tracking-widest"
                              >
                                Segarkan Halaman
                              </button>
                            </div>
                          </>
                       ) : (
                          <>
                            <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                               <Plus className="w-6 h-6 text-slate-300" />
                            </div>
                            <div className="space-y-2">
                              <p className="text-slate-900 text-xs font-black uppercase tracking-tight">Kertas Kerja Masih Kosong</p>
                              <p className="text-slate-400 text-[10px] leading-relaxed">Klik "Tambah Baris" untuk memulai analisis risiko atau data akan otomatis muncul jika sudah ada di Google Sheets Anda.</p>
                            </div>
                          </>
                       )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </div>
  );
}
