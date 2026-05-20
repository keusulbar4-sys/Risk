import React, { useState, useEffect } from 'react';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend 
} from 'recharts';
import { 
  AlertTriangle, 
  CheckCircle2, 
  ShieldAlert, 
  Activity,
  Info
} from 'lucide-react';
import { cn } from '../lib/utils';

const COLORS = {
  'Sangat Tinggi': '#EF4444',
  'Tinggi': '#F97316',
  'Sedang': '#EAB308',
  'Rendah': '#22C55E',
  'Sangat Rendah': '#3B82F6',
};

const mockSummary = [
  { name: 'Sangat Tinggi', value: 4 },
  { name: 'Tinggi', value: 7 },
  { name: 'Sedang', value: 12 },
  { name: 'Rendah', value: 8 },
  { name: 'Sangat Rendah', value: 3 },
];

const mockTrends = [
  { name: 'Jan', tinggi: 5, sedang: 10, rendah: 5 },
  { name: 'Feb', tinggi: 7, sedang: 8, rendah: 10 },
  { name: 'Mar', tinggi: 4, sedang: 12, rendah: 8 },
  { name: 'Apr', tinggi: 6, sedang: 11, rendah: 9 },
];

export function DashboardView({ spreadsheetId, token, tahun }: { spreadsheetId: string, token: string, tahun?: string }) {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [spreadsheetId, token]);

  if (loading) {
    return (
      <div className="animate-pulse grid grid-cols-12 grid-rows-6 gap-4 h-full">
        <div className="col-span-8 row-span-3 bg-white rounded-2xl h-[340px]" />
        <div className="col-span-4 row-span-2 bg-indigo-600 rounded-2xl h-[220px]" />
        <div className="col-span-4 row-span-1 bg-white rounded-2xl h-[100px]" />
        <div className="col-span-4 row-span-3 bg-white rounded-2xl h-[340px]" />
        <div className="col-span-8 row-span-3 bg-white rounded-2xl h-[340px]" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-12 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Heatmap Card */}
      <div className="col-span-12 lg:col-span-8 row-span-3 bg-white rounded-2xl border border-slate-200 p-6 shadow-sm flex flex-col">
        <div className="flex justify-between items-center mb-6">
          <h2 className="font-bold text-slate-800 flex items-center gap-2 uppercase tracking-tighter italic">
            Risk Heatmap Visualizer <span className="text-indigo-600">TA {tahun}</span>
            <Info className="w-4 h-4 text-slate-300" />
          </h2>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Live Analysis</span>
        </div>
        <div className="flex-1 flex items-end gap-3 min-h-[240px]">
          <HeatmapBar count="04" label="Extreme" color="bg-red-500" height="h-full" />
          <HeatmapBar count="12" label="High" color="bg-orange-400" height="h-3/4" />
          <HeatmapBar count="08" label="Medium" color="bg-yellow-400" height="h-2/4" />
          <HeatmapBar count="21" label="Low" color="bg-green-500" height="h-1/4" />
        </div>
      </div>

      {/* Main Stats Card */}
      <div className="col-span-12 lg:col-span-4 row-span-2 bg-indigo-600 text-white rounded-2xl p-6 shadow-lg flex flex-col justify-between">
        <div>
          <p className="text-indigo-200 text-xs font-bold uppercase tracking-wider mb-2">Total Risks Registered</p>
          <h3 className="text-6xl font-black tracking-tight">45</h3>
        </div>
        <div className="mt-4 bg-white/10 p-4 rounded-xl border border-white/20 backdrop-blur-sm">
          <p className="text-xs opacity-90 italic leading-relaxed">
            "Ensuring organizational resilience through systematic identification and mitigation."
          </p>
        </div>
      </div>

      {/* Toggle Card */}
      <div className="col-span-12 lg:col-span-4 row-span-1 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm font-bold text-slate-800">Auto-Notifications</span>
        </div>
        <div className="w-10 h-5 bg-indigo-600 rounded-full relative cursor-pointer shadow-inner">
          <div className="absolute right-1 top-1 w-3 h-3 bg-white rounded-full shadow-sm"></div>
        </div>
      </div>

      {/* Sync Logs Card */}
      <div className="col-span-12 lg:col-span-4 row-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
        <h2 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
          Sync Logs
          <Activity className="w-4 h-4 text-slate-300" />
        </h2>
        <div className="space-y-5 overflow-y-auto">
          <LogItem status="success" title="Sheets Sync Success" desc="Imported 12 rows to 'Identifikasi'" color="bg-green-500" />
          <LogItem status="warning" title="Validation Warning" desc="Row 24: Missing Risk Owner" color="bg-amber-500" />
          <LogItem status="info" title="Template Updated" desc="Custom columns saved for 'Analisis'" color="bg-indigo-500" />
          <LogItem status="success" title="Backup Created" desc="Automatic backup to Google Drive" color="bg-green-500" />
        </div>
      </div>

      {/* Data Table Card */}
      <div className="col-span-12 lg:col-span-8 row-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col">
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex justify-between items-center">
          <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Preview: Context_Risiko.csv</span>
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
            <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-50/50 border-b border-slate-100 sticky top-0 backdrop-blur-sm">
              <tr>
                <th className="px-6 py-4 font-bold text-slate-400 uppercase tracking-wider">ID</th>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase">Unit/Area</th>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase">Sasaran Terkait</th>
                <th className="px-6 py-4 font-bold text-slate-900 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              <Row id="RISK-01" area="Operasional" goal="Stabilitas Layanan Publik" stakeholders="Aktif" />
              <Row id="RISK-02" area="Keuangan" goal="Efisiensi Anggaran" stakeholders="Monitoring" />
              <Row id="RISK-03" area="SDM" goal="Kapasitas Pegawai" stakeholders="Aktif" />
              <Row id="RISK-04" area="Teknis" goal="Keamanan Data" stakeholders="Closed" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeatmapBar({ count, label, color, height }: any) {
  return (
    <div className={cn("flex-1 rounded-xl flex flex-col justify-center items-center text-white p-4 transition-all hover:scale-[1.02] shadow-sm", color, height)}>
      <span className="text-4xl font-black mb-1">{count}</span>
      <span className="text-[10px] uppercase font-black tracking-[0.2em] opacity-80">{label}</span>
    </div>
  );
}

function LogItem({ title, desc, color }: any) {
  return (
    <div className="flex gap-4 group">
      <div className={cn("w-1 h-10 rounded-full shrink-0 group-hover:w-1.5 transition-all", color)}></div>
      <div className="flex flex-col justify-center">
        <p className="text-xs font-bold text-slate-800">{title}</p>
        <p className="text-[10px] text-slate-400 font-medium">{desc}</p>
      </div>
    </div>
  );
}

function Row({ id, area, goal, stakeholders }: any) {
  return (
    <tr className="hover:bg-slate-50/80 transition-colors">
      <td className="px-6 py-4 text-slate-400 font-mono">{id}</td>
      <td className="px-6 py-4 font-bold text-slate-700">{area}</td>
      <td className="px-6 py-4 text-slate-500 font-medium">{goal}</td>
      <td className="px-6 py-4">
        <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-md font-bold text-[10px] uppercase tracking-tighter">
          {stakeholders}
        </span>
      </td>
    </tr>
  );
}

function StatCard({ label, value, icon: Icon, trend, color }: any) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
  };
  
  return (
    <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-3 rounded-2xl", colors[color as keyof typeof colors])}>
          <Icon className="w-6 h-6" />
        </div>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-tight">{label}</span>
      </div>
      <div>
        <h3 className="text-3xl font-bold text-gray-900">{value}</h3>
        <p className="text-xs text-gray-500 mt-1">{trend}</p>
      </div>
    </div>
  );
}
