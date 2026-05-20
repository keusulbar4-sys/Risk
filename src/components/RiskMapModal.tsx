import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Target, 
  AlertTriangle, 
  Zap, 
  ArrowRight,
  Maximize2
} from 'lucide-react';
import { cn } from '../lib/utils';

interface RiskMapModalProps {
  isOpen: boolean;
  onClose: () => void;
  riskData: any;
  opdName?: string;
  tahun?: string;
}

export function RiskMapModal({ isOpen, onClose, riskData, opdName, tahun }: RiskMapModalProps) {
  if (!riskData) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />

          {/* Modal Content */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-5xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Header */}
            <div className="p-6 md:p-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Maximize2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-800 uppercase tracking-tighter italic">Peta Hubungan Risiko</h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{opdName} • Periode {tahun}</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full hover:bg-slate-200 transition-colors flex items-center justify-center text-slate-400"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Visual Flow Area */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-12">
              <div className="grid md:grid-cols-3 gap-8 items-center relative">
                {/* Visual Connection Lines (Desktop) */}
                <div className="hidden md:block absolute top-1/2 left-[30%] right-[30%] h-px bg-slate-100 -translate-y-1/2 z-0" />
                
                {/* 1. Context / Objective */}
                <motion.div 
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="z-10 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-indigo-200 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center">
                      <Target className="w-4 h-4 text-indigo-600" />
                    </div>
                    <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Tujuan / Sasaran</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed min-h-[80px]">
                    {riskData.tujuan || 'Data tujuan tidak tersedia.'}
                  </p>
                  <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <ArrowRight className="w-4 h-4 text-indigo-200" />
                  </div>
                </motion.div>

                {/* 2. The Risk */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 }}
                  className="z-10 bg-slate-900 p-8 rounded-[2rem] shadow-xl space-y-4 ring-8 ring-slate-50 relative"
                >
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-red-600 rounded-full">
                    <span className="text-[9px] font-black text-white uppercase">Critical Point</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    </div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pernyataan Risiko</span>
                  </div>
                  <p className="text-base font-black text-white leading-tight italic">
                    "{riskData.uraian || 'Judul risiko belum diisi.'}"
                  </p>
                  <div className="pt-4 border-t border-slate-800">
                    <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">Penyebab Utama:</p>
                    <p className="text-[11px] text-slate-400 mt-1 italic leading-relaxed">
                      {riskData.sebab || 'Belum diidentifikasi.'}
                    </p>
                  </div>
                </motion.div>

                {/* 3. The Impact */}
                <motion.div 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="z-10 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 hover:border-amber-200 transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-amber-600" />
                    </div>
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Dampak / Akibat</span>
                  </div>
                  <p className="text-sm font-medium text-slate-600 leading-relaxed min-h-[80px]">
                    {riskData.dampak || 'Dampak belum dievaluasi.'}
                  </p>
                  {riskData.dampakPihak && (
                     <div className="mt-2 p-3 bg-amber-50/50 rounded-xl border border-amber-100/50">
                        <p className="text-[9px] font-black text-amber-800 uppercase italic">Pihak Terkena:</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{riskData.dampakPihak}</p>
                     </div>
                  )}
                </motion.div>
              </div>

              {/* metadata info and help */}
              <div className="grid md:grid-cols-2 gap-8 pt-8">
                <div className="bg-slate-50 p-6 rounded-3xl space-y-3">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Kode Klasifikasi</h4>
                  <div className="flex gap-2">
                    {riskData.kode?.split('.').map((part: string, i: number) => (
                      <div key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg font-mono text-xs font-bold text-slate-600">
                        {part}
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 p-6 border border-dashed border-slate-200 rounded-3xl">
                   <div className="shrink-0 w-10 h-10 border border-slate-200 rounded-full flex items-center justify-center text-slate-300">?</div>
                   <p className="text-[11px] text-slate-500 leading-relaxed">
                     Visualisasi ini membantu anda memahami bagaimana kegagalan dalam proses kerja berdampak langsung pada pencapaian sasaran institusi.
                   </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-slate-100 flex justify-center bg-slate-50/30">
               <button 
                 onClick={onClose}
                 className="bg-slate-800 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-900 transition active:scale-95"
               >
                 Close Map
               </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
