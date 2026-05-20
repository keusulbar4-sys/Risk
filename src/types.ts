export type RiskLevel = 'Sangat Rendah' | 'Rendah' | 'Sedang' | 'Tinggi' | 'Sangat Tinggi';

export interface RiskEntry {
  id: string;
  tujuan: string;
  indikator: string;
  uraian: string;
  kode: string;
  pemilik: string;
  sebab: string;
  sumber: string;
  controlType: 'C' | 'UC';
  dampak: string;
  pihakTerkena: string;
  
  // Analysis
  impactScores: number[]; // P1-P5
  probScores: number[]; // P1-P5
  impactAvg: number;
  probAvg: number;
  score: number;
  level: RiskLevel;

  // Evaluation
  controlExist: string;
  gap: string;
  residualImpact: number;
  residualProb: number;
  residualScore: number;
  residualLevel: RiskLevel;

  // RTP
  rtpBaru: string;
  pj: string;
  deadline: string;
}

export interface ContextData {
  pemda: string;
  tahun: string;
  periode: string;
  urusan: string;
  opd: string;
  sumberData: string;
  tujuanStrategis: string;
  sasaranStrategis: { no: number; sasaran: string; iku: string; target: string }[];
  programStrategis: { no: number; program: string; iku: string; target: string }[];
}

export interface CommConsultation {
  no: number;
  kegiatan: string;
  media: string;
  penyedia: string;
  penerima: string;
  rencanaWaktu: string;
  realisasiWaktu: string;
  keterangan: string;
}

export interface MonitoringReview {
  no: number;
  kegiatan: string;
  metode: string;
  pj: string;
  rencanaWaktu: string;
  realisasiWaktu: string;
  keterangan: string;
}

export interface RiskIncident {
  no: number;
  uraian: string;
  kode: string;
  tanggal: string;
  sebabActual: string;
  dampakActual: string;
  keterangan: string;
  rtp: string;
  rtpRencana: string;
  rtpRealisasi: string;
  rtpKeterangan: string;
}
