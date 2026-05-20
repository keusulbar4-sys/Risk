import React, { useState } from 'react';
import { Save, Plus, Trash2, ClipboardList, RefreshCw, X } from 'lucide-react';
import { SheetService } from '../services/sheets';
import { cn } from '../lib/utils';

interface ContextViewProps {
  spreadsheetId: string;
  token: string;
  data: any;
  setData: (d: any) => void;
  sasaran: any[];
  setSasaran: (s: any[]) => void;
  ikuSasaran: any[];
  setIkuSasaran: (i: any[]) => void;
  program: any[];
  setProgram: (p: any[]) => void;
  assessments: any[];
  setAssessments: (a: any[]) => void;
  signature: any;
  setSignature: (s: any) => void;
  onSpreadsheetError?: () => void;
}

export function ContextView({ 
  spreadsheetId, 
  token,
  data, setData,
  sasaran, setSasaran,
  ikuSasaran, setIkuSasaran,
  program, setProgram,
  assessments, setAssessments,
  signature, setSignature,
  onSpreadsheetError
}: ContextViewProps) {
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    const fetchData = async () => {
      if (!spreadsheetId || !token) return;
      setFetching(true);
      setError(null);
      const service = new SheetService(spreadsheetId, token);
      
      try {
        // Load Context Info
        const ctxData = await service.read('1. Konteks!B2:B9');
        if (ctxData && ctxData.length > 0) {
          setData({
            ...data,
            pemda: ctxData[0]?.[0] || data.pemda,
            tahun: ctxData[1]?.[0] || data.tahun,
            periode: ctxData[2]?.[0] || data.periode,
            urusan: ctxData[3]?.[0] || data.urusan,
            opd: ctxData[4]?.[0] || data.opd,
            sumberData: ctxData[5]?.[0] || data.sumberData,
            tujuanStrategis: ctxData[6]?.[0] || data.tujuanStrategis,
            informasiLain: ctxData[7]?.[0] || data.informasiLain,
          });
        }

        // Load Tables (Sasaran, IKU, Program)
        const sasaranData = await service.read('1. Konteks!G2:H20');
        if (sasaranData && sasaranData.length > 0) {
          const rows = sasaranData.filter(r => r[1]).map(r => ({ no: parseInt(r[0]), text: r[1] }));
          if (rows.length > 0) setSasaran(rows);
        }

        const ikuData = await service.read('1. Konteks!J2:L20');
        if (ikuData && ikuData.length > 0) {
          const rows = ikuData.filter(r => r[1]).map(r => ({ no: parseInt(r[0]), text: r[1], value: r[2] }));
          if (rows.length > 0) setIkuSasaran(rows);
        }

        const programData = await service.read('1. Konteks!N2:O20');
        if (programData && programData.length > 0) {
          const rows = programData.filter(r => r[1]).map(r => ({ no: parseInt(r[0]), text: r[1] }));
          if (rows.length > 0) setProgram(rows);
        }

        // Load Signature
        const sigData = await service.read('1. Konteks!C32:C36');
        if (sigData && sigData.length >= 5) {
           setSignature({
             location: sigData[0]?.[0] || '',
             date: sigData[1]?.[0] || '',
             title: sigData[2]?.[0] || '',
             name: sigData[3]?.[0] || '',
             nip: sigData[4]?.[0] || '',
           });
        }

        // Load Assessment Table
        const assessmentData = await service.read('1. Konteks!A20:E40'); // Read up to 20 rows
        if (assessmentData && assessmentData.length > 0) {
          const rows = assessmentData
            .filter(r => r[1]?.toString().trim() || r[2]?.toString().trim() || r[3]?.toString().trim() || r[4]?.toString().trim()) // filter empty rows properly
            .map((r, i) => ({
              id: Date.now() + i,
              tujuan: r[1] || '',
              sasaran: r[2] || '',
              program: r[3] || '',
              iku: r[4] || ''
            }));
          if (rows.length > 0) {
            setAssessments(rows);
          } else {
            // Keep default empty row if no data in cloud
            setAssessments([{ id: Date.now(), tujuan: '', sasaran: '', program: '', iku: '' }]);
          }
        }

      } catch (err: any) {
        console.error('Failed to pre-load context from sheets:', err);
        const is404 = err.message?.toLowerCase().includes('not found') || err.message?.includes('404');
        if (is404) {
           setError('ID Spreadsheet tidak ditemukan (404).');
           if (onSpreadsheetError) onSpreadsheetError();
        }
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [spreadsheetId, token]);

  const updateSasaran = (index: number, text: string) => {
    const newSasaran = [...sasaran];
    newSasaran[index].text = text;
    setSasaran(newSasaran);
  };

  const removeSasaran = (index: number) => {
    const newSasaran = sasaran.filter((_, i) => i !== index).map((s, i) => ({ ...s, no: i + 1 }));
    setSasaran(newSasaran);
  };

  const updateIkuSasaran = (index: number, field: 'text' | 'value', val: string) => {
    const newIku = [...ikuSasaran];
    newIku[index][field] = val;
    setIkuSasaran(newIku);
  };

  const removeIku = (index: number) => {
    const newIku = ikuSasaran.filter((_, i) => i !== index).map((s, i) => ({ ...s, no: i + 1 }));
    setIkuSasaran(newIku);
  };

  const updateProgram = (index: number, text: string) => {
    const newProgram = [...program];
    newProgram[index].text = text;
    setProgram(newProgram);
  };

  const removeProgram = (index: number) => {
    const newProgram = program.filter((_, i) => i !== index).map((s, i) => ({ ...s, no: i + 1 }));
    setProgram(newProgram);
  };

  const updateAssessment = (id: number, field: string, val: string) => {
    setAssessments(assessments.map(a => a.id === id ? { ...a, [field]: val } : a));
  };

  const handleSave = async () => {
    setFetching(true);
    const service = new SheetService(spreadsheetId, token);
    const contextRows = [
      ['I. PENETAPAN KONTEKS RISIKO STRATEGIS OPD'],
      ['Nama Pemerintah Daerah', ':', data.pemda],
      ['Tahun Penilaian', ':', data.tahun],
      ['Periode yang dinilai', ':', data.periode],
      ['Urusan Pemerintahan', ':', data.urusan],
      ['OPD yang Dinilai', ':', data.opd],
      ['Sumber Data', ':', data.sumberData],
      ['Tujuan Strategis', ':', data.tujuanStrategis],
      ['Informasi Lain', ':', data.informasiLain],
    ];

    const signatureRows = [
      [signature.location],
      [signature.date],
      [signature.title],
      [signature.name],
      [signature.nip]
    ];

    const assessmentRows = assessments.map((a, idx) => [
      idx + 1,
      a.tujuan,
      a.sasaran,
      a.program,
      a.iku
    ]);
    
    try {
      // 1. General Data
      await service.write('1. Konteks!B2:B11', contextRows.slice(1).map(r => [r[2]])); 
      
      // 2. Signature
      await service.write('1. Konteks!C32:C36', signatureRows);
      
      // 3. Tables Data Persistence
      if (sasaran.length > 0) {
        await service.write('1. Konteks!G2:H' + (2 + sasaran.length), sasaran.map(s => [s.no, s.text]));
      }
      if (ikuSasaran.length > 0) {
        await service.write('1. Konteks!J2:L' + (2 + ikuSasaran.length), ikuSasaran.map(s => [s.no, s.text, s.value]));
      }
      if (program.length > 0) {
        await service.write('1. Konteks!N2:O' + (2 + program.length), program.map(s => [s.no, s.text]));
      }

      // 4. Assessment Table
      if (assessmentRows.length > 0) {
        await service.write('1. Konteks!A20:E' + (20 + assessmentRows.length), assessmentRows);
      }
      
      alert('Berhasil menyimpan Konteks dan Tabel Strategis ke Google Sheets!');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan data konteks.');
    } finally {
      setFetching(false);
    }
  };

  return (
    <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-20">
      {fetching && (
        <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-xl animate-pulse">
           <RefreshCw className="w-3 h-3 text-indigo-500 animate-spin" />
           <span className="text-[10px] font-black text-indigo-600 uppercase tracking-tighter">Syncing Cloud Data...</span>
        </div>
      )}
      {error && !fetching && (
        <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600">
           <X className="w-4 h-4" />
           <span className="text-xs font-bold uppercase tracking-tight">{error}</span>
        </div>
      )}
      {/* General Info Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h3 className="text-lg font-bold text-slate-900">Informasi Umum</h3>
            <p className="text-xs text-slate-500 font-medium">Lengkapi data profil penetapan konteks risiko.</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={fetching}
            className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-lg text-xs font-bold hover:bg-indigo-700 transition shadow-sm disabled:opacity-50"
          >
            {fetching ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            Simpan ke Sheets
          </button>
        </div>

        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
          <InputGroup label="Pemerintah Daerah" value={data.pemda} onChange={v => setData({...data, pemda: v})} />
          <InputGroup label="Tahun Penilaian" value={data.tahun} onChange={v => setData({...data, tahun: v})} />
          <InputGroup label="Periode" value={data.periode} onChange={v => setData({...data, periode: v})} />
          <InputGroup label="Urusan" value={data.urusan} onChange={v => setData({...data, urusan: v})} />
          <div className="md:col-span-2">
            <InputGroup label="OPD" value={data.opd} onChange={v => setData({...data, opd: v})} />
          </div>
          <div className="md:col-span-2">
            <InputGroup label="Sumber Data" value={data.sumberData} onChange={v => setData({...data, sumberData: v})} />
          </div>
          <div className="md:col-span-2">
            <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">Tujuan Strategis</label>
            <textarea 
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition text-sm text-slate-700 min-h-[120px]"
              value={data.tujuanStrategis || ''}
              onChange={e => setData({...data, tujuanStrategis: e.target.value})}
            />
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 gap-6">
        <TableSection 
          title="SASARAN STRATEGIS" 
          columns={['NO', 'SASARAN STRATEGIS']}
          rows={sasaran.map((s, idx) => [
            s.no, 
            <input 
              key={`input-sasaran-${idx}`}
              value={s.text} 
              onChange={e => updateSasaran(idx, e.target.value)} 
              className="w-full bg-transparent p-1 outline-none focus:bg-slate-50 rounded" 
              placeholder="Masukkan sasaran strategis..."
            />
          ])}
          onAdd={() => setSasaran([...sasaran, { no: sasaran.length + 1, text: '' }])}
          onDelete={removeSasaran}
          addLabel="TAMBAH SASARAN STRATEGIS"
          pasteLabel="PASTE SASARAN (EXCEL)"
        />

        <TableSection 
          title="IKU SASARAN OPD" 
          columns={['NO', 'IKU SASARAN OPD', data.tahun || '2026']}
          rows={ikuSasaran.map((s, idx) => [
            s.no, 
            <input 
              key={`iku-text-${idx}`} 
              value={s.text} 
              onChange={e => updateIkuSasaran(idx, 'text', e.target.value)}
              className="w-full bg-transparent p-1 outline-none focus:bg-slate-50 rounded" 
              placeholder="Masukkan IKU..."
            />,
            <input 
              key={`iku-val-${idx}`} 
              value={s.value} 
              onChange={e => updateIkuSasaran(idx, 'value', e.target.value)}
              className="w-full bg-transparent p-1 font-bold text-center outline-none focus:bg-slate-50 rounded" 
              placeholder="Nilai"
            />
          ])}
          onAdd={() => setIkuSasaran([...ikuSasaran, { no: ikuSasaran.length + 1, text: '', value: '' }])}
          onDelete={removeIku}
          addLabel="TAMBAH IKU SASARAN OPD"
          pasteLabel="PASTE IKU (EXCEL)"
        />

        <TableSection 
          title="PROGRAM STRATEGIS" 
          columns={['NO', 'PROGRAM STRATEGIS']}
          rows={program.map((s, idx) => [
            s.no, 
            <input 
              key={`prog-text-${idx}`} 
              value={s.text} 
              onChange={e => updateProgram(idx, e.target.value)}
              className="w-full bg-transparent p-1 outline-none focus:bg-slate-50 rounded" 
              placeholder="Masukkan program strategis..."
            />
          ])}
          onAdd={() => setProgram([...program, { no: program.length + 1, text: '' }])}
          onDelete={removeProgram}
          addLabel="TAMBAH PROGRAM STRATEGIS"
          pasteLabel="PASTE PROGRAM (EXCEL)"
        />
      </div>

      <div className="flex items-center gap-4 py-4 px-2">
         <span className="text-sm font-bold text-slate-800 shrink-0">Informasi lain</span>
         <span className="text-slate-400">:</span>
         <input 
           type="text" 
           className="flex-1 bg-transparent border-b border-slate-200 text-sm outline-none focus:border-indigo-500 transition-colors" 
           value={data.informasiLain || ''}
           onChange={e => setData({...data, informasiLain: e.target.value})} 
         />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
          <h3 className="text-xs font-black uppercase tracking-widest leading-loose max-w-lg">
            TUJUAN, SASARAN, PROGRAM STRATEGIS, IKU PROGRAM YANG AKAN DILAKUKAN PENILAIAN RISIKO
          </h3>
          <div className="flex gap-2">
            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg text-[10px] font-bold border border-white/20 transition">
              <ClipboardList className="w-3 h-3" />
              PASTE ASSESSMENT (EXCEL)
            </button>
            <button 
              onClick={() => setAssessments([...assessments, { id: Date.now(), tujuan: '', sasaran: '', program: '', iku: '' }])}
              className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded-lg text-[10px] font-bold transition"
            >
              <Plus className="w-3 h-3" />
              TAMBAH BARIS
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800">
                <th className="px-6 py-4 w-16">NO</th>
                <th className="px-6 py-4">TUJUAN STRATEGIS</th>
                <th className="px-6 py-4">SASARAN STRATEGIS</th>
                <th className="px-6 py-4">PROGRAM STRATEGIS</th>
                <th className="px-6 py-4">IKU PROGRAM</th>
                <th className="px-6 py-4 w-20 text-center">AKSI</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assessments.map((row, idx) => (
                <tr key={row.id} className="group hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-10 font-bold text-slate-400">{idx + 1}</td>
                  <td className="px-6 py-4">
                    <select 
                      value={row.tujuan}
                      onChange={e => updateAssessment(row.id, 'tujuan', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-medium outline-none"
                    >
                      <option value="">- Pilih Tujuan Strategis -</option>
                      {data.tujuanStrategis && (
                        <option value={data.tujuanStrategis}>{data.tujuanStrategis.substring(0, 70)}...</option>
                      )}
                      {/* If existing value is not the main one and not empty, keep it as an option so it doesn't disappear */}
                      {row.tujuan && row.tujuan !== data.tujuanStrategis && (
                        <option value={row.tujuan}>{row.tujuan.substring(0, 70)}...</option>
                      )}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={row.sasaran}
                      onChange={e => updateAssessment(row.id, 'sasaran', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-medium outline-none"
                    >
                      <option value="">- Pilih Sasaran Strategis -</option>
                      {sasaran.map(s => <option key={`sasaran-opt-${s.no}`} value={s.text}>{s.text.substring(0, 50)}...</option>)}
                      {row.sasaran && !sasaran.find(s => s.text === row.sasaran) && (
                        <option value={row.sasaran}>{row.sasaran.substring(0, 50)}...</option>
                      )}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={row.program}
                      onChange={e => updateAssessment(row.id, 'program', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-medium outline-none"
                    >
                      <option value="">- Pilih Program Strategis -</option>
                      {program.map(s => <option key={`prog-opt-${s.no}`} value={s.text}>{s.text.substring(0, 50)}...</option>)}
                      {row.program && !program.find(s => s.text === row.program) && (
                        <option value={row.program}>{row.program.substring(0, 50)}...</option>
                      )}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      value={row.iku}
                      onChange={e => updateAssessment(row.id, 'iku', e.target.value)}
                      className="w-full bg-slate-50 border border-slate-100 p-2 rounded-lg text-xs font-medium outline-none"
                    >
                      <option value="">- Pilih IKU Program -</option>
                      {ikuSasaran.map(s => <option key={`iku-opt-${s.no}`} value={s.text}>{s.text}</option>)}
                      {row.iku && !ikuSasaran.find(s => s.text === row.iku) && (
                        <option value={row.iku}>{row.iku}</option>
                      )}
                    </select>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button 
                      onClick={() => setAssessments(assessments.filter(a => a.id !== row.id))}
                      className="p-2 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex justify-end pt-12 pr-12">
        <div className="text-center w-80 space-y-24">
          <div className="flex flex-col gap-1 items-center">
            <div className="flex items-center gap-2 border-b border-slate-200 w-full justify-center pb-1">
              <input 
                className="bg-transparent text-sm font-medium text-slate-800 text-right outline-none" 
                value={signature.location || ''} 
                onChange={e => setSignature({...signature, location: e.target.value})} 
              />
              <span className="text-slate-400">,</span>
              <input 
                className="bg-transparent text-sm font-medium text-slate-800 outline-none" 
                value={signature.date || ''} 
                onChange={e => setSignature({...signature, date: e.target.value})} 
              />
            </div>
            <p className="text-xs font-bold text-slate-900 mt-2">{signature.title}</p>
            <p className="text-xs font-medium text-slate-500 italic">{data.pemda}</p>
          </div>
          
          <div className="flex flex-col gap-1">
            <p className="text-sm font-black text-slate-900 underline">{signature.name}</p>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{signature.nip}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TableSection({ title, columns, rows, onAdd, onDelete, addLabel, pasteLabel }: any) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-100">
              {columns.map((col: string, i: number) => (
                <th key={col} className={cn(
                  "px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest",
                  i === 0 && "w-20"
                )}>
                  {col}
                </th>
              ))}
              {onDelete && <th className="px-6 py-3 w-16 text-center"></th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50/50 transition-colors group">
                {row.map((cell: any, j: number) => (
                  <td key={j} className={cn(
                    "px-6 py-3 text-xs font-medium text-slate-700",
                    j === 0 && "font-bold text-slate-400"
                  )}>
                    {cell}
                  </td>
                ))}
                {onDelete && (
                  <td className="px-6 py-3 text-center">
                    <button 
                      onClick={() => onDelete(i)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition opacity-100 md:opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 bg-slate-50/30 border-t border-slate-50 flex gap-3">
        {onAdd && (
          <button 
            onClick={onAdd}
            className="flex items-center gap-2 text-[10px] font-black text-indigo-600 hover:text-indigo-700 uppercase tracking-widest"
          >
            <Plus className="w-3.5 h-3.5" />
            {addLabel}
          </button>
        )}
        {pasteLabel && (
          <button className="flex items-center gap-2 text-[10px] font-black text-slate-400 hover:text-slate-600 border border-slate-200 px-3 py-1.5 rounded-lg uppercase tracking-widest shadow-sm bg-white transition">
            <ClipboardList className="w-3.5 h-3.5" />
            {pasteLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function InputGroup({ label, value, onChange }: { label: string, value: string, onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest">{label}</label>
      <input 
        type="text" 
        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 focus:bg-white outline-none transition text-sm text-slate-700 font-medium"
        value={value || ''}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
