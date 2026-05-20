import React, { useState } from 'react';
import { RefreshCw, Plus, FileText, ChevronUp, ChevronDown, Circle, Eye, Map } from 'lucide-react';
import { GenericRiskTable } from './RiskTable';
import { SheetService } from '../services/sheets';
import { COLUMN_DEFINITIONS } from '../constants/columns';
import { cn } from '../lib/utils';
import { RiskMapModal } from './RiskMapModal';

interface IdentificationViewProps {
  spreadsheetId: string;
  token: string;
  rows: any[];
  onRowsChange: (rows: any[]) => void;
  menu1Assessments?: any[];
  opdName?: string;
  tahun?: string;
}

export function IdentificationView({ 
  spreadsheetId, 
  token, 
  rows, 
  onRowsChange,
  menu1Assessments = [],
  opdName = 'OPD',
  tahun = '2026'
}: IdentificationViewProps) {
  const [syncing, setSyncing] = useState(false);
  const [selectedRisk, setSelectedRisk] = useState<any>(null);
  const [isMapOpen, setIsMapOpen] = useState(false);

  const handleAddSubRisk = (index: number) => {
    const parentRow = rows[index];
    const currentNo = parentRow.no || (index + 1).toString();
    const newRow = {
      ...parentRow,
      id: Date.now().toString(),
      no: currentNo,
      uraian: '', // Clear fields that should be unique to the new risk
      kode: '',
      sebab: '',
      sebabSumber: '',
      dampak: '',
      dampakPihak: '',
      _isNew: true
    };
    
    const newRows = [...rows];
    newRows.splice(index + 1, 0, newRow);
    onRowsChange(newRows);
  };

  const ID_COLUMNS = [
    { 
      key: 'no', 
      label: 'No', 
      width: 'w-12',
      render: (row: any, idx: number, handleChange: any) => (
        <div className="text-center font-black text-slate-800 text-xs">
          <input 
            className="w-full bg-transparent text-center outline-none"
            value={row.no || idx + 1}
            onChange={(e) => handleChange('no', e.target.value)}
          />
        </div>
      )
    },
    { 
      key: 'tujuan', 
      label: 'Tujuan / Sasaran',
      width: 'min-w-[280px]',
      render: (row: any, idx: number, handleChange: any) => (
        <div className="space-y-3">
          <div className="relative group">
            <textarea 
              className="w-full bg-slate-50/50 border border-transparent focus:border-indigo-100 focus:bg-white rounded-xl px-3 py-2 text-[11px] text-slate-600 font-medium leading-relaxed outline-none transition resize-none min-h-[60px]"
              value={row.tujuan || ''}
              onChange={(e) => handleChange('tujuan', e.target.value)}
            />
            <div className="absolute -right-2 top-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <ChevronUp className="w-3 h-3 text-slate-300 cursor-pointer hover:text-indigo-500" />
               <Circle className="w-2 h-2 fill-slate-300 text-slate-300" />
               <ChevronDown className="w-3 h-3 text-slate-300 cursor-pointer hover:text-indigo-500" />
            </div>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => handleAddSubRisk(idx)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-[9px] font-black text-indigo-600 rounded-lg hover:bg-indigo-100 transition shadow-sm border border-indigo-200/50 uppercase tracking-tighter"
            >
              <Plus className="w-2.5 h-2.5" />
              Tambah Risiko
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 text-[9px] font-black text-slate-500 rounded-lg hover:bg-slate-100 transition shadow-sm border border-slate-200/50 uppercase tracking-tighter">
              <FileText className="w-2.5 h-2.5" />
              Paste Risiko
            </button>
          </div>
        </div>
      )
    },
    { 
      key: 'indikator', 
      label: 'Indikator Kinerja',
      width: 'min-w-[220px]',
      render: (row: any, idx: number, handleChange: any) => (
        <div className="relative group p-1">
          <textarea 
            className="w-full bg-transparent border-none focus:ring-0 text-[11px] text-slate-500 font-medium leading-relaxed outline-none transition resize-none min-h-[60px]"
            value={row.indikator || ''}
            onChange={(e) => handleChange('indikator', e.target.value)}
          />
          <div className="absolute -right-2 top-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
             <ChevronUp className="w-3 h-3 text-slate-300 cursor-pointer hover:text-indigo-500" />
             <Circle className="w-2 h-2 fill-slate-300 text-slate-300" />
             <ChevronDown className="w-3 h-3 text-slate-300 cursor-pointer hover:text-indigo-500" />
          </div>
        </div>
      )
    },
    { 
      key: 'uraian', 
      label: 'Risiko (Uraian)',
      width: 'min-w-[250px]',
      render: (row: any, idx: number, handleChange: any) => (
        <div className="relative group p-1">
          <textarea 
            className="w-full bg-slate-50/30 border-none focus:bg-white focus:ring-2 focus:ring-indigo-50 rounded-xl px-2 py-1.5 text-[11px] text-slate-700 font-bold leading-normal outline-none transition resize-none min-h-[80px]"
            value={row.uraian || ''}
            placeholder="Ketik uraian risiko di sini..."
            onChange={(e) => handleChange('uraian', e.target.value)}
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
               onClick={() => {
                 setSelectedRisk(row);
                 setIsMapOpen(true);
               }}
               className="bg-white/80 backdrop-blur scale-90 hover:scale-100 hover:bg-white text-indigo-600 p-2 rounded-lg border border-indigo-100 shadow-sm transition-all"
               title="Visualisasi Hubungan Risiko"
            >
               <Map className="w-3 h-3" />
            </button>
          </div>
          <div className="absolute -right-2 top-0 flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
             <ChevronUp className="w-3 h-3 text-slate-300 cursor-pointer hover:text-indigo-500" />
             <Circle className="w-2 h-2 fill-slate-300 text-slate-300" />
             <ChevronDown className="w-3 h-3 text-slate-300 cursor-pointer hover:text-indigo-500" />
          </div>
        </div>
      )
    },
    { 
      key: 'kode', 
      label: 'Risiko (Kode)',
      render: (row: any, idx: number, handleChange: any) => {
        const parts = (row.kode || '00.00.00').split('.');
        const updatePart = (pIdx: number, val: string) => {
          const newParts = [...parts];
          newParts[pIdx] = val.padStart(2, '0').substring(0, 2);
          handleChange('kode', newParts.join('.'));
        };
        return (
          <div className="space-y-2 text-center flex flex-col items-center justify-center">
            <span className="text-[9px] font-black text-slate-400 block tracking-widest italic uppercase">RS0.26</span>
            <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-slate-100 shadow-sm">
              <input 
                className="w-8 h-8 text-center text-xs font-black text-indigo-600 rounded bg-indigo-50/30 outline-none focus:ring-2 focus:ring-indigo-500" 
                value={parts[0] || '08'} 
                onChange={e => updatePart(0, e.target.value)}
              />
              <span className="text-slate-300 font-bold">.</span>
              <input 
                className="w-8 h-8 text-center text-xs font-black text-indigo-600 rounded bg-indigo-50/30 outline-none focus:ring-2 focus:ring-indigo-500" 
                value={parts[1] || '21'} 
                onChange={e => updatePart(1, e.target.value)}
              />
              <span className="text-slate-300 font-bold">.</span>
              <input 
                className="w-8 h-8 text-center text-xs font-black text-indigo-600 rounded bg-indigo-50/30 outline-none focus:ring-2 focus:ring-indigo-500" 
                value={parts[2] || '01'} 
                onChange={e => updatePart(2, e.target.value)}
              />
            </div>
          </div>
        )
      }
    },
    { 
      key: 'pemilik', 
      label: 'Pemilik',
      render: (row: any, idx: number, handleChange: any) => (
        <textarea 
          className="w-full bg-transparent border-none text-center text-[10px] font-black text-slate-900 uppercase tracking-tight outline-none resize-none overflow-hidden" 
          value={row.pemilik || ''}
          placeholder="JABATAN..."
          rows={2}
          onChange={(e) => handleChange('pemilik', e.target.value)}
        />
      )
    },
    { 
      key: 'sebab', 
      label: 'Sebab (Uraian)',
      render: (row: any, idx: number, handleChange: any) => (
        <textarea 
          className="w-full bg-transparent border-none text-[11px] text-slate-600 font-medium italic leading-relaxed outline-none resize-none min-h-[60px]" 
          value={row.sebab || ''}
          placeholder="Ketikan sebab..."
          onChange={(e) => handleChange('sebab', e.target.value)}
        />
      )
    },
    { 
      key: 'sebabSumber', 
      label: 'Sebab (Sumber)',
      render: (row: any, idx: number, handleChange: any) => (
        <textarea 
          className="w-full bg-transparent border-none text-center text-[10px] font-black text-slate-800 uppercase outline-none resize-none overflow-hidden" 
          value={row.sebabSumber || ''}
          placeholder="SUMBER..."
          rows={2}
          onChange={(e) => handleChange('sebabSumber', e.target.value)}
        />
      )
    },
    { 
      key: 'control', 
      label: 'Control (C/UC)',
      width: 'w-24',
      render: (row: any, idx: number, handleChange: any) => (
        <div className="flex flex-col items-center gap-2">
          <div 
            onClick={() => handleChange('control', row.control === 'C' ? 'UC' : 'C')}
            className={cn(
              "w-12 h-6 rounded-full p-1 cursor-pointer transition-all duration-300 relative border shadow-inner",
              row.control === 'C' ? "bg-emerald-500 border-emerald-600" : "bg-orange-500 border-orange-600"
            )}
          >
            <div className={cn(
              "absolute top-0.5 w-4.5 h-4.5 bg-white rounded-full shadow-md transition-all duration-300 flex items-center justify-center text-[8px] font-black",
              row.control === 'C' ? "left-0.5 text-emerald-600" : "left-6.5 text-orange-600"
            )}>
              {row.control || 'C'}
            </div>
          </div>
          <span className="text-[9px] font-black text-slate-400">{row.control === 'C' ? 'Controllable' : 'Uncontrollable'}</span>
        </div>
      )
    },
    { 
      key: 'dampak', 
      label: 'Dampak (Akibat)',
      render: (row: any, idx: number, handleChange: any) => (
        <textarea 
          className="w-full bg-transparent border-none text-[11px] text-slate-600 font-medium italic leading-relaxed outline-none resize-none min-h-[60px]" 
          value={row.dampak || ''}
          placeholder="Ketikan dampak..."
          onChange={(e) => handleChange('dampak', e.target.value)}
        />
      )
    },
    { 
      key: 'dampakPihak', 
      label: 'Dampak (Pihak)',
      render: (row: any, idx: number, handleChange: any) => (
        <textarea 
          className="w-full bg-transparent border-none text-[11px] text-slate-600 font-medium italic leading-relaxed outline-none resize-none min-h-[60px]" 
          value={row.dampakPihak || ''}
          placeholder="Ketikan pihak terkena..."
          onChange={(e) => handleChange('dampakPihak', e.target.value)}
        />
      )
    }
  ];

  const handleSyncFromMenu1 = async () => {
    // We prefer local state from menu1 if available, otherwise we could fetch from sheets.
    // Since we now pass menu1Assessments, let's use it.
    
    const sourceData = menu1Assessments.filter(a => a.tujuan || a.sasaran || a.iku);
    
    if (sourceData.length === 0) {
      // Fallback: try to read from sheets if local state is empty (maybe just loaded)
      setSyncing(true);
      const service = new SheetService(spreadsheetId, token);
      try {
        const data = await service.read('1. Konteks!A20:E60');
        if (data && data.length > 0) {
          const syncRows = data
            .filter(row => row && row.length >= 2 && (row[1] || row[2]))
            .map((row, idx) => ({
              id: `sync-sheet-${Date.now()}-${idx}`,
              no: (rows.length + idx + 1).toString(),
              tujuan: row[1] || row[2] || '', 
              indikator: row[4] || '',
              uraian: '',
              kode: '',
              pemilik: '',
              sebab: '',
              sebabSumber: '',
              control: 'C',
              dampak: '',
              dampakPihak: ''
            }));
          
          if (syncRows.length > 0) {
            onRowsChange([...rows, ...syncRows]);
            alert(`Berhasil menarik ${syncRows.length} data dari Google Sheets Menu 1.`);
            return;
          }
        }
      } catch (err) {
        console.error('Sheet sync failed:', err);
      } finally {
        setSyncing(false);
      }
      
      alert('Tidak ada data di Menu 1 yang bisa ditarik. Pastikan Menu 1 sudah diisi.');
      return;
    }

    // Map from local state
    const syncRows = sourceData.map((a, idx) => ({
      id: `sync-local-${Date.now()}-${idx}`,
      no: (rows.length + idx + 1).toString(),
      tujuan: a.tujuan || a.sasaran || '', 
      indikator: a.iku || '',
      uraian: '',
      kode: '',
      pemilik: '',
      sebab: '',
      sebabSumber: '',
      control: 'C',
      dampak: '',
      dampakPihak: ''
    }));

    // Filter out rows that are already in the table (simple check by purpose and indicator)
    const newRows = syncRows.filter(nr => 
      !rows.some(r => r.tujuan === nr.tujuan && r.indikator === nr.indikator)
    );

    if (newRows.length === 0 && syncRows.length > 0) {
      alert('Semua data dari Menu 1 sudah ada di tabel Identifikasi.');
      return;
    }

    onRowsChange([...rows, ...newRows]);
    alert(`Berhasil menarik ${newRows.length} data baru dari Menu 1.`);
  };

  const footer = (
    <div className="flex items-center justify-between px-2 pt-4 border-t border-slate-100 mt-6">
      <button 
        onClick={handleSyncFromMenu1}
        disabled={syncing}
        className="flex items-center gap-2 text-[11px] font-black text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-5 py-2.5 rounded-xl uppercase tracking-widest transition-all shadow-sm border border-emerald-100 disabled:opacity-50"
      >
        <RefreshCw className={syncing ? "w-3.5 h-3.5 animate-spin" : "w-3.5 h-3.5"} />
        {syncing ? 'Menyinkronkan...' : 'Sinkronisasi dari Menu 1'}
      </button>
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
        <p className="text-[10px] text-slate-400 font-black uppercase tracking-tighter">
          Data tersinkronisasi otomatis dengan Cloud
        </p>
      </div>
    </div>
  );

  const extraHeader = (
    <div className="bg-slate-900 text-white p-6 rounded-2xl flex justify-between items-center shadow-lg border border-slate-800">
      <div>
        <h2 className="text-xl font-black italic tracking-tighter uppercase">Formulir Kertas Kerja Identifikasi Risiko Strategis OPD</h2>
      </div>
      <div className="text-right">
        <p className="text-xs font-bold text-slate-400 capitalize">Tahun {tahun} (Milik {opdName})</p>
      </div>
    </div>
  );

  return (
    <>
      <GenericRiskTable 
        title="Identifikasi Risiko"
        description="Identifikasi sasaran, indikator, dan potensi risiko yang mungkin timbul."
        sheetName="2. Identifikasi"
        columns={ID_COLUMNS}
        spreadsheetId={spreadsheetId}
        token={token}
        rows={rows}
        tahun={tahun}
        onRowsChange={onRowsChange}
        footer={footer}
        extraHeader={extraHeader}
      />

      <RiskMapModal 
        isOpen={isMapOpen}
        onClose={() => setIsMapOpen(false)}
        riskData={selectedRisk}
        opdName={opdName}
        tahun={tahun}
      />
    </>
  );
}
