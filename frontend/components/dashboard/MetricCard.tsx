import React from "react";
import { MoreVertical } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string | null;
  index?: number;
}

export default function MetricCard({ label, value, delta, index = 0 }: MetricCardProps) {
  const [displayValue, setDisplayValue] = React.useState("0");

  React.useEffect(() => {
    // Basic animation for numeric values
    const numericPart = value.replace(/[^0-9]/g, "");
    if (!numericPart) {
      setDisplayValue(value);
      return;
    }

    const target = parseFloat(numericPart);
    const prefix = value.match(/^[^0-9]*/)?.[0] || "";
    const suffix = value.match(/[0-9]*([^0-9]*)$/)?.[1] || "";

    let start = 0;
    const duration = 800; // ms
    const startTime = performance.now();

    function animate(time: number) {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      const easeProgress = progress * (2 - progress);
      const current = Math.floor(start + easeProgress * (target - start));
      
      let formatted = current.toLocaleString();
      if (prefix === "$" && current >= 1000) {
        formatted = current.toLocaleString();
      }
      
      setDisplayValue(`${prefix}${formatted}${suffix}`);

      if (progress < 1) {
        requestAnimationFrame(animate);
      } else {
        setDisplayValue(value);
      }
    }

    requestAnimationFrame(animate);
  }, [value]);

  const isFirstCard = index === 0;

  return (
    <div 
      className={`relative overflow-hidden transition-all duration-300 group rounded-2xl p-5 flex flex-col justify-between h-[125px] ${
        isFirstCard 
          ? "bg-gradient-to-br from-[#A7F3D0] via-[#A7F3D0] to-[#6EE7B7] text-[#062F16] border-0 shadow-[0_0_20px_rgba(110,231,183,0.15)]"
          : "border border-[rgba(255,255,255,0.06)] bg-[#111118] text-white shadow-xl"
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Concentric circle wave paths for the first card */}
      {isFirstCard && (
        <div className="absolute inset-0 pointer-events-none opacity-45 mix-blend-overlay">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <circle cx="85" cy="85" r="45" fill="none" stroke="white" strokeWidth="4" opacity="0.35" />
            <circle cx="85" cy="85" r="65" fill="none" stroke="white" strokeWidth="4" opacity="0.25" />
            <circle cx="85" cy="85" r="85" fill="none" stroke="white" strokeWidth="4" opacity="0.18" />
            <circle cx="85" cy="85" r="105" fill="none" stroke="white" strokeWidth="4" opacity="0.12" />
          </svg>
        </div>
      )}

      {/* Top Row: Label and Three Dots */}
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-sans font-medium tracking-wide ${isFirstCard ? "text-[#062F16]/75" : "text-[#888899]"}`}>
          {label}
        </span>
        <button className={`p-0.5 rounded transition-colors cursor-pointer ${isFirstCard ? "hover:bg-black/5 text-[#062F16]/60" : "hover:bg-white/5 text-[#555566] hover:text-white"}`}>
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle Row: Large Value */}
      <div className="mt-1">
        <h3 className={`text-2xl font-bold tracking-tight ${isFirstCard ? "text-[#062F16]" : "text-white"}`}>
          {displayValue}
        </h3>
      </div>

      {/* Bottom Row: Delta Pill Badge */}
      <div className="mt-1.5 flex justify-start">
        {delta && (
          <span 
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold ${
              isFirstCard
                ? "bg-white/90 text-[#062F16]"
                : "bg-[#132A21] text-[#3CD395] border border-[#1E3F33]/30"
            }`}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
