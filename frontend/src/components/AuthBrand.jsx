import React from "react";

export default function AuthBrand() {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="DataInsight AI"
        className="w-11 h-11 object-contain shrink-0"
      />

      <div>
        <div className="font-semibold text-[16px] tracking-tight text-white leading-tight">
          DataInsight AI
        </div>

        <div className="text-[11px] text-slate-500 leading-tight mt-0.5">
          Intelligent Data Analytics
        </div>
      </div>
    </div>
  );
}