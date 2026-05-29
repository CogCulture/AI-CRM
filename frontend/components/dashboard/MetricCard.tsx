import React from "react";
import { MoreVertical } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  delta?: string | null;
  index?: number;
}

export default function MetricCard({
  label,
  value,
  delta,
  index = 0,
}: MetricCardProps) {
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

  const isAccent = index === 0;

  return (
    <div 
      className={`relative overflow-hidden transition-colors duration-150 group p-5 flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#111118] text-gray-900 dark:text-white shadow-sm dark:shadow-xl ${
        isAccent ? "border-t-2 border-t-emerald-500 dark:border-t-emerald-400" : ""
      }`}
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Subtle background glow for the accent card */}
      {isAccent && (
        <div className="absolute -right-6 -bottom-6 w-16 h-16 rounded-full bg-emerald-500/5 blur-xl pointer-events-none" />
      )}

      {/* Top Row: Label and Three Dots */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-sans font-medium tracking-wide text-gray-500 dark:text-[#888899]">
          {label}
        </span>
        <button className="p-0.5 rounded transition-colors cursor-pointer hover:bg-gray-100 dark:hover:bg-white/5 text-[#888899] hover:text-gray-900 dark:hover:text-white">
          <MoreVertical className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Middle Row: Large Value */}
      <div className="mt-1">
        <h3 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
          {displayValue}
        </h3>
      </div>

      {/* Bottom Row: Delta Pill Badge */}
      <div className="mt-1.5 flex justify-start">
        {delta && (
          <span 
            className="inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-[#3CD395] border border-emerald-500/20"
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
