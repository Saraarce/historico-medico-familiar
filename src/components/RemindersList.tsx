import React from "react";
import { FamilyMember, Consultation, Vaccine } from "../types";
import { Calendar, Bell, Syringe, Clock, AlertCircle, Share2, CornerDownRight, CheckCircle } from "lucide-react";

interface RemindersListProps {
  members: FamilyMember[];
  consultations: Consultation[];
  vaccines: Vaccine[];
}

export default function RemindersList({ members, consultations, vaccines }: RemindersListProps) {
  const todayStr = new Date().toISOString().split("T")[0];

  // 1. Get upcoming consultations (today or future)
  const upcomingConsultations = consultations
    .filter((c) => c.date >= todayStr)
    .map((c) => {
      const member = members.find((m) => m.id === c.memberId);
      return { ...c, member, type: "consultation" as const };
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  // 2. Get pending or overdue vaccines
  const pendingVaccines = vaccines
    .filter((v) => v.status === "pending" || v.status === "overdue")
    .map((v) => {
      const member = members.find((m) => m.id === v.memberId);
      return { ...v, member, type: "vaccine" as const };
    })
    .sort((a, b) => {
      if (a.status === "overdue" && b.status !== "overdue") return -1;
      if (a.status !== "overdue" && b.status === "overdue") return 1;
      return (a.dueDate || "").localeCompare(b.dueDate || "");
    });

  // Count total alerts
  const overdueCount = pendingVaccines.filter((v) => v.status === "overdue").length;
  const upcomingCount = upcomingConsultations.length + pendingVaccines.filter((v) => v.status === "pending").length;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    return `${day}/${month}/${year}`;
  };

  const getDaysDiff = (dateStr: string) => {
    const t = new Date(todayStr).getTime();
    const d = new Date(dateStr).getTime();
    const diffTime = d - t;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const truncateText = (text: string, length: number) => {
    if (!text) return "";
    return text.length > length ? text.substring(0, length) + "..." : text;
  };

  // WhatsApp reminder generator
  const sendWhatsAppReminder = (item: any) => {
    let text = "";
    const memberName = item.member?.name || "Familiar";
    
    if (item.type === "consultation") {
      const days = getDaysDiff(item.date);
      const daysLabel = days === 0 ? "HOJE" : days === 1 ? "amanhã" : `em ${days} dias (${formatDate(item.date)})`;
      text = `Lembrete de Consulta Médica! 🏥\n\nOlá, gostaria de lembrar que ${memberName} tem uma consulta agendada de *${item.specialty}* com o(a) ${item.doctor}.\n\n📅 Data: ${formatDate(item.date)} (${daysLabel})\n📍 Local: ${item.facility}\n📝 Motivo: ${item.reason || "Rotina"}\n\nPor favor, não se esqueça de levar a carteirinha e os exames anteriores!`;
    } else {
      const isOverdue = item.status === "overdue";
      text = `Lembrete de Vacina Pendente! 💉\n\nOlá! Passando para avisar que a vacina *${item.name}* (${item.dose}) de *${memberName}* está ${isOverdue ? "⚠️ ATRASADA" : "pendente"}.\n\n📅 Prazo sugerido: ${formatDate(item.dueDate)}\n\nVacinar é cuidar! Vamos manter a carteirinha em dia. 🌸`;
    }

    const encText = encodeURIComponent(text);
    const waUrl = `https://api.whatsapp.com/send?text=${encText}`;
    window.open(waUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="space-y-6" id="reminders-root">
      {/* Overview Dashboard Card */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 bottom-0 translate-x-12 translate-y-12 w-48 h-48 bg-white/5 rounded-full blur-xl" />
        <div className="absolute left-1/3 top-0 -translate-y-6 w-32 h-32 bg-sky-200/5 rounded-full blur-lg" />
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-200 animate-swing" />
            <span className="text-sm font-semibold tracking-wider uppercase text-sky-100">Painel de Lembretes</span>
          </div>
          {overdueCount > 0 && (
            <span className="bg-red-500 text-white font-bold text-xxs px-2.5 py-1 rounded-full animate-pulse flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              {overdueCount} ATRASOS
            </span>
          )}
        </div>

        <h2 className="text-2xl font-extrabold tracking-tight mb-2">Central de Alertas da Família</h2>
        <p className="text-sm text-sky-100 leading-relaxed max-w-xl">
          Aqui estão compilados os compromissos agendados e doses pendentes de vacina para os 6 integrantes. Use o botão de envio para lembrar seu familiar via WhatsApp!
        </p>

        <div className="grid grid-cols-2 gap-4 mt-6 pt-4 border-t border-white/10 text-center">
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
            <span className="text-2xl font-black block">{upcomingConsultations.length}</span>
            <span className="text-xs font-semibold text-sky-100">Consultas Agendadas</span>
          </div>
          <div className="bg-white/10 rounded-xl p-3 backdrop-blur-xs">
            <span className="text-2xl font-black block">{pendingVaccines.length}</span>
            <span className="text-xs font-semibold text-sky-100 font-medium">Vacinas Pendentes</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Side: Consultations reminders */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Próximas Consultas</h3>
                <p className="text-xs text-gray-500">Agendas futuras cadastradas</p>
              </div>
            </div>
            <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
              {upcomingConsultations.length}
            </span>
          </div>

          {upcomingConsultations.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <Clock className="w-10 h-10 mx-auto text-gray-300 mb-2" />
              <p className="text-sm font-medium">Nenhuma consulta pendente</p>
              <p className="text-xs mt-1">Ótimo trabalho! Adicione consultas no prontuário de cada membro.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {upcomingConsultations.map((item) => {
                const days = getDaysDiff(item.date);
                const isToday = days === 0;
                
                return (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      isToday 
                        ? "border-amber-200 bg-amber-50/40" 
                        : "border-gray-100 bg-gray-50/20 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.member?.avatarColor || "bg-blue-500"}`} />
                        <span className="font-bold text-gray-900 text-sm">{item.member?.name}</span>
                        <span className="text-xs text-gray-500">({item.member?.relationship})</span>
                      </div>
                      
                      <span className={`text-2xs font-bold px-2 py-0.5 rounded-md ${
                        isToday 
                          ? "bg-amber-500 text-white animate-pulse" 
                          : days === 1 ? "bg-amber-100 text-amber-800" : "bg-blue-50 text-blue-700"
                      }`}>
                        {isToday ? "HOJE" : days === 1 ? "Amanhã" : `Em ${days} dias`}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-2">
                      <div className="md:col-span-8">
                        <h4 className="font-bold text-gray-800 text-sm">{item.specialty}</h4>
                        <p className="text-xs text-gray-600 mt-0.5 font-medium">Médico: {item.doctor}</p>
                        <p className="text-2xs text-gray-500">{item.facility}</p>
                        {item.reason && (
                          <div className="flex items-center gap-1 mt-1 text-2xs text-gray-500 italic">
                            <CornerDownRight className="w-3 h-3 shrink-0" />
                            <span>{truncateText(item.reason, 60)}</span>
                          </div>
                        )}
                      </div>

                      <div className="md:col-span-4 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end gap-2 mt-2.5 md:mt-0 pt-2.5 md:pt-0 border-t md:border-t-0 md:border-l border-gray-100 w-full md:w-auto">
                        <div className="text-xs font-bold text-gray-700 md:mb-1">{formatDate(item.date)}</div>
                        <button
                          type="button"
                          id={`btn-remind-consult-${item.id}`}
                          onClick={() => sendWhatsAppReminder(item)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-3xs font-black cursor-pointer uppercase select-none"
                          title="Enviar lembrete por Whatsapp"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Side: Vaccines reminders */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-xs">
          <div className="flex items-center justify-between border-b border-gray-100 pb-4 mb-4">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                <Syringe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-base">Vacinas Pendentes</h3>
                <p className="text-xs text-gray-500">Imunizantes pendentes ou em atraso</p>
              </div>
            </div>
            <span className="text-xs font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md">
              {pendingVaccines.length}
            </span>
          </div>

          {pendingVaccines.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <CheckCircle className="w-10 h-10 mx-auto text-emerald-500 mb-2" />
              <p className="text-sm font-medium">Tudo imunizado!</p>
              <p className="text-xs mt-1">Excelente! Todas as vacinas estão em dia para a família.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto pr-1">
              {pendingVaccines.map((item) => {
                const isOverdue = item.status === "overdue";
                
                return (
                  <div 
                    key={item.id} 
                    className={`p-4 rounded-xl border transition-all ${
                      isOverdue 
                        ? "border-red-200 bg-red-50/20" 
                        : "border-gray-100 bg-gray-50/20 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${item.member?.avatarColor || "bg-rose-500"}`} />
                        <span className="font-bold text-gray-900 text-sm">{item.member?.name}</span>
                        <span className="text-xs text-gray-500">({item.member?.relationship})</span>
                      </div>
                      
                      <span className={`text-2xs font-extrabold px-2 py-0.5 rounded-md ${
                        isOverdue 
                          ? "bg-red-500 text-white animate-pulse" 
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {isOverdue ? "⚠️ ATRASADA" : "Pendente"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-12 gap-2 mt-2">
                      <div className="md:col-span-8">
                        <h4 className="font-bold text-gray-800 text-sm">{item.name}</h4>
                        <p className="text-xs text-gray-500 font-medium">Dose: {item.dose}</p>
                        {isOverdue && (
                          <p className="text-2xs text-red-600 font-bold mt-1 inline-flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Atrasada! Regularize o quanto antes.
                          </p>
                        )}
                      </div>

                      <div className="md:col-span-4 flex flex-row md:flex-col justify-between md:justify-center items-center md:items-end gap-2 mt-2.5 md:mt-0 pt-2.5 md:pt-0 border-t md:border-t-0 md:border-l border-gray-100 w-full md:w-auto">
                        {item.dueDate && (
                          <div className={`text-xs font-bold md:mb-1 ${isOverdue ? "text-red-650" : "text-gray-700"}`}>
                            Até {formatDate(item.dueDate)}
                          </div>
                        )}
                        <button
                          type="button"
                          id={`btn-remind-vaccine-${item.id}`}
                          onClick={() => sendWhatsAppReminder(item)}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white rounded-lg transition-colors flex items-center gap-1 text-3xs font-black cursor-pointer uppercase select-none"
                          title="Enviar lembrete por Whatsapp"
                        >
                          <Share2 className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
