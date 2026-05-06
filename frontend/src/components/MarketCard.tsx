import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatUsd } from '@/lib/api';
import type { ApiMarket } from '@/lib/api-types';

interface MarketCardProps {
  market: ApiMarket;
  compact?: boolean;
}

export function MarketCard({ market, compact = false }: MarketCardProps) {
  const yesProb = Math.round(market.yesPrice * 100);
  const noProb = 100 - yesProb;
  
  // Calculate multipliers (1 / price)
  const yesMultiplier = (1 / market.yesPrice).toFixed(2);
  const noMultiplier = (1 / (1 - market.yesPrice)).toFixed(2);

  // Determine top-level entity label (e.g., from question or category)
  const entityLabel = market.category.toUpperCase();

  return (
    <Link
      to={`/markets/${market.id}`}
      className={cn(
        "group relative flex flex-col w-full bg-[#0B0B0B] border border-white/5 rounded-[24px] p-6 transition-all duration-300 hover:bg-[#111111] hover:border-white/10 hover:shadow-2xl",
        compact ? "max-w-sm" : ""
      )}
    >
      {/* Header: Label */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[11px] font-black tracking-widest text-[#888888] uppercase">
          {entityLabel}
        </span>
      </div>

      {/* Title */}
      <h3 className="text-[17px] font-bold text-white leading-snug mb-8 line-clamp-2 min-h-[3rem]">
        {market.question}
      </h3>

      {/* Outcomes Grid */}
      <div className="flex flex-col gap-6 mb-8">
        {/* Yes Row */}
        <div className="flex items-center justify-between group/row">
          <div className="flex flex-col gap-1 flex-1 mr-8">
            <span className="text-base font-semibold text-white/95">Yes</span>
            <div className="h-[3px] w-full bg-[#1A1A1A] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#00FFBD] transition-all duration-1000 ease-out shadow-[0_0_8px_rgba(0,255,189,0.2)]" 
                style={{ width: `${yesProb}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-[13px] font-medium text-[#555555]">{yesMultiplier}x</span>
            <div className="min-w-[68px] h-[36px] rounded-full border border-[#00FFBD]/30 flex items-center justify-center bg-[#00FFBD]/5">
              <span className="text-[14px] font-bold text-white">{yesProb}%</span>
            </div>
          </div>
        </div>

        {/* No Row */}
        <div className="flex items-center justify-between group/row">
          <div className="flex flex-col gap-1 flex-1 mr-8">
            <span className="text-base font-semibold text-white/95">No</span>
            <div className="h-[3px] w-full bg-[#1A1A1A] rounded-full overflow-hidden">
              <div 
                className="h-full bg-[#FF4F4F] transition-all duration-1000 ease-out" 
                style={{ width: `${noProb}%` }}
              />
            </div>
          </div>
          <div className="flex items-center gap-5">
            <span className="text-[13px] font-medium text-[#555555]">{noMultiplier}x</span>
            <div className="min-w-[68px] h-[36px] rounded-full border border-white/10 flex items-center justify-center bg-white/5">
              <span className="text-[14px] font-bold text-white">{noProb}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <span className="text-[12px] font-medium text-[#555555]">
          {formatUsd(market.volume)} vol
        </span>
        <span className="text-[12px] font-medium text-[#555555]">
          {market.participants || 1} market
        </span>
      </div>
    </Link>
  );
}
