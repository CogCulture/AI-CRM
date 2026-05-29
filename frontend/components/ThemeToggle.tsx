"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  const handleToggle = () => {
    const css = document.createElement("style");
    css.type = "text/css";
    css.appendChild(
      document.createTextNode(
        `* {
           -webkit-transition: none !important;
           -moz-transition: none !important;
           -o-transition: none !important;
           -ms-transition: none !important;
           transition: none !important;
        }`
      )
    );
    document.head.appendChild(css);

    setTheme(theme === "dark" ? "light" : "dark");

    setTimeout(() => {
      try {
        document.head.removeChild(css);
      } catch (e) {}
    }, 20);
  };

  return (
    <button
      onClick={handleToggle}
      className="p-1.5 rounded-lg border border-gray-200 dark:border-[rgba(255,255,255,0.06)] bg-white dark:bg-[#161622] hover:bg-gray-50 dark:hover:bg-[#1C1C2D] text-gray-500 dark:text-[#888899] hover:text-gray-900 dark:hover:text-white transition-all cursor-pointer"
    >
      {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}
