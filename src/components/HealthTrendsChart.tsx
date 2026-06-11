import React, { useState } from "react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts";
import { HealthVital, FamilyMember } from "../types";
import { TrendingUp, Activity, ShieldAlert, Heart, Ruler, Scale } from "lucide-react";

interface HealthTrendsChartProps {
  member: FamilyMember;
  vitals: HealthVital[];
}

type VitalMetric = "weight" | "bloodPressure" | "bloodGlucose" | "height" | "imc";

export default function HealthTrendsChart({ member, vitals }: HealthTrendsChartProps) {
  const [activeMetric, setActiveMetric] = useState<VitalMetric>("weight");

  // Age Calculator
  const getAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const isChild = getAge(member.birthDate) < 18;

  // Filter and sort vitals by date
  const memberVitals = vitals
    .filter((v) => v.memberId === member.id)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningWeight: number | null = null;
  let runningHeight: number | null = null;

  // Format dates for display
  const chartData = memberVitals.map((v) => {
    const [year, month, day] = v.date.split("-");
    const formattedDate = `${day}/${month}`;
    
    if (v.weight !== undefined && v.weight !== null) runningWeight = v.weight;
    if (v.height !== undefined && v.height !== null) runningHeight = v.height;

    let calcedImc: number | null = null;
    if (runningWeight && runningHeight) {
      const hMeters = runningHeight / 100;
      calcedImc = Number((runningWeight / (hMeters * hMeters)).toFixed(1));
    }

    return {
      ...v,
      formattedDate,
      // For blood pressure double line
      systolic: v.systolicBP || null,
      diastolic: v.diastolicBP || null,
      glucose: v.bloodGlucose || null,
      weight: v.weight || null,
      height: v.height || null,
      imc: calcedImc
    };
  });

  // Calculate stats
  const latestVital = memberVitals[memberVitals.length - 1];
  const latestWithImc = [...chartData].reverse().find((d) => d.imc !== null);
  const latestImc = latestWithImc ? latestWithImc.imc : null;

  const getImcStatusLabel = (val: number) => {
    if (val < 18.5) return "Abaixo do peso";
    if (val < 25) return "Peso normal";
    if (val < 30) return "Sobrepeso";
    if (val < 35) return "Obesidade I";
    if (val < 40) return "Obesidade II";
    return "Obesidade III";
  };

  const getImcStatusColor = (val: number) => {
    if (val < 18.5) return "text-amber-600 bg-amber-50 border border-amber-100";
    if (val < 25) return "text-emerald-600 bg-emerald-50 border border-emerald-100";
    if (val < 30) return "text-amber-600 bg-amber-50 border border-amber-100";
    return "text-red-600 bg-red-50 border border-red-100";
  };
  
  const metricConfig = {
    weight: {
      label: "Peso Corporal",
      color: "#3b82f6", // blue
      unit: " kg",
      icon: TrendingUp,
      desc: "Acompanhamento de peso saudável e índice de massa corporal",
      hasData: memberVitals.some(v => v.weight !== undefined)
    },
    bloodPressure: {
      label: "Pressão Arterial",
      color: "#ef4444", // red
      unit: " mmHg",
      icon: Heart,
      desc: "Níveis sistólicos (máxima) e diastólicos (mínima)",
      hasData: memberVitals.some(v => v.systolicBP !== undefined && v.diastolicBP !== undefined)
    },
    bloodGlucose: {
      label: "Glicemia de Jejum",
      color: "#eab308", // yellow/amber
      unit: " mg/dL",
      icon: Activity,
      desc: "Controle e prevenção de picos e hipoglicemia",
      hasData: memberVitals.some(v => v.bloodGlucose !== undefined)
    },
    height: {
      label: "Estatura / Altura",
      color: "#ec4899", // pink
      unit: " cm",
      icon: Ruler,
      desc: "Curva de crescimento e evolução estatural infantil",
      hasData: memberVitals.some(v => v.height !== undefined)
    },
    imc: {
      label: "Índice de Massa Corporal (IMC)",
      color: "#10b981", // emerald
      unit: "",
      icon: Scale,
      desc: "Relação peso-altura: <18.5 Baixo | 18.5-24.9 Normal | 25-29.9 Sobrepeso | >=30 Obesidade",
      hasData: chartData.some(v => v.imc !== null)
    }
  };

  const config = metricConfig[activeMetric];

  // Render chart conditionally
  const renderChart = () => {
    if (chartData.length === 0 || !config.hasData) {
      return (
        <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
          <ShieldAlert className="w-8 h-8 text-gray-400 mb-2 animate-pulse" />
          <p className="text-sm font-semibold text-gray-700">Histórico de dados indisponível</p>
          <p className="text-xs text-gray-500 mt-1 max-w-xs">Insira novas aferições clínicas de {member.name} com peso e altura para ativar o gráfico.</p>
        </div>
      );
    }

    return (
      <div className="h-72 w-full mt-4" id="recharts-wrapper">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
            <XAxis 
              dataKey="formattedDate" 
              tickLine={false} 
              axisLine={false} 
              tick={{ fill: "#9ca3af", fontSize: 11 }} 
            />
            <YAxis 
              tickLine={false} 
              axisLine={false} 
              domain={["auto", "auto"]}
              tick={{ fill: "#9ca3af", fontSize: 11 }} 
            />
            <Tooltip 
              contentStyle={{ background: "#ffffff", border: "1px solid #f3f4f6", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}
              labelStyle={{ fontWeight: "bold", fontSize: "12px", color: "#1f2937" }}
              itemStyle={{ fontSize: "12px" }}
            />
            <Legend 
              verticalAlign="top" 
              height={36} 
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: "12px", fontWeight: "medium" }}
            />
            
            {activeMetric === "weight" && (
              <Line 
                name="Peso (kg)" 
                type="monotone" 
                dataKey="weight" 
                stroke="#3b82f6" 
                strokeWidth={3} 
                activeDot={{ r: 8 }} 
                dot={{ r: 4, strokeWidth: 2 }}
                connectNulls
              />
            )}

            {activeMetric === "bloodPressure" && (
              <>
                <Line 
                   name="Sistólica (Máx)" 
                  type="monotone" 
                  dataKey="systolic" 
                  stroke="#ef4444" 
                  strokeWidth={3} 
                  activeDot={{ r: 8 }} 
                  dot={{ r: 4, strokeWidth: 2 }}
                  connectNulls
                />
                <Line 
                  name="Diastólica (Mín)" 
                  type="monotone" 
                  dataKey="diastolic" 
                  stroke="#ff8a8a" 
                  strokeWidth={2.5} 
                  activeDot={{ r: 6 }} 
                  dot={{ r: 3, strokeWidth: 1.5 }}
                  connectNulls
                />
              </>
            )}

            {activeMetric === "bloodGlucose" && (
              <Line 
                name="Glicemia (mg/dL)" 
                type="monotone" 
                dataKey="glucose" 
                stroke="#d97706" 
                strokeWidth={3} 
                activeDot={{ r: 8 }} 
                dot={{ r: 4, strokeWidth: 2 }}
                connectNulls
              />
            )}

            {activeMetric === "height" && (
              <Line 
                name="Altura (cm)" 
                type="monotone" 
                dataKey="height" 
                stroke="#ec4899" 
                strokeWidth={3} 
                activeDot={{ r: 8 }} 
                dot={{ r: 4, strokeWidth: 2 }}
                connectNulls
              />
            )}

            {activeMetric === "imc" && (
              <Line 
                name="IMC" 
                type="monotone" 
                dataKey="imc" 
                stroke="#10b981" 
                strokeWidth={3} 
                activeDot={{ r: 8 }} 
                dot={{ r: 4, strokeWidth: 2 }}
                connectNulls
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const visibleMetrics: VitalMetric[] = isChild
    ? ["weight", "bloodPressure", "bloodGlucose", "height", "imc"]
    : ["weight", "bloodPressure", "bloodGlucose", "imc"];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 mt-4" id={`trends-chart-${member.id}`}>
      {/* Metric Selector Tabs */}
      <div className="flex flex-wrap gap-2 bg-gray-50 p-1.5 rounded-xl mb-5">
        {visibleMetrics.map((metric) => {
          const isSelected = activeMetric === metric;
          const cfg = metricConfig[metric];
          const Icon = cfg.icon;
          return (
            <button
              key={metric}
              type="button"
              onClick={() => setActiveMetric(metric)}
              className={`flex-1 min-w-[90px] sm:min-w-0 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all cursor-pointer ${
                isSelected 
                  ? "bg-white text-gray-900 shadow-xs border border-gray-200/50" 
                  : "text-gray-500 hover:text-gray-800"
              }`}
            >
              <Icon className={`w-4 h-4 ${isSelected ? "text-blue-500" : "text-gray-400"}`} />
              <span className="hidden sm:inline">{cfg.label}</span>
              <span className="sm:hidden">{cfg.label.split(" ")[0]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="font-bold text-gray-800 text-sm">{config.label}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{config.desc}</p>
        </div>
        
        {/* Latest entry indicator */}
        {latestVital && config.hasData && (
          <div className="text-right">
            <span className="text-2xs font-bold text-gray-400 uppercase tracking-wider block font-bold">Última Aferição</span>
            <div className="text-sm font-bold text-gray-900 mt-0.5">
              {activeMetric === "weight" && latestVital.weight ? `${latestVital.weight} kg` : ""}
              {activeMetric === "bloodGlucose" && latestVital.bloodGlucose ? `${latestVital.bloodGlucose} mg/dL` : ""}
              {activeMetric === "bloodPressure" && latestVital.systolicBP && latestVital.diastolicBP 
                ? `${latestVital.systolicBP}/${latestVital.diastolicBP} mmHg` 
                : ""}
              {activeMetric === "height" && latestVital.height ? `${latestVital.height} cm` : ""}
              {activeMetric === "imc" && latestImc ? (
                <div className="flex flex-col items-end">
                  <span className="text-base font-extrabold text-emerald-600">{latestImc}</span>
                  <span className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded border ${getImcStatusColor(latestImc)} mt-1 select-none`}>
                    {getImcStatusLabel(latestImc)}
                  </span>
                </div>
              ) : ""}
            </div>
          </div>
        )}
      </div>

      {renderChart()}
    </div>
  );
}
