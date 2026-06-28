"use client";

import React, { useState, useEffect } from "react";
import { Reorder, useDragControls } from "framer-motion";
import { GripVertical, RotateCcw } from "lucide-react";
import { PortfolioSummaryCards } from "@/components/PortfolioSummaryCards";
import { PnLWidget } from "@/components/chart/PnLWidget";
import { PortfolioAllocationChart } from "@/components/chart/PortfolioAllocationChart";

const DEFAULT_ORDER = ["summary", "pnl", "allocation"];
const STORAGE_KEY = "stellar-swipe-dashboard-layout";

export function DashboardWidgets() {
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === DEFAULT_ORDER.length &&
          parsed.every((x) => DEFAULT_ORDER.includes(x))
        ) {
          setOrder(parsed);
        }
      } catch (e) {
        // Ignore parsing errors
      }
    }
    setMounted(true);
  }, []);

  const handleReorder = (newOrder: string[]) => {
    setOrder(newOrder);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newOrder));
  };

  const handleReset = () => {
    setOrder(DEFAULT_ORDER);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_ORDER));
  };

  const moveItem = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= order.length) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(index, 1);
    newOrder.splice(newIndex, 0, moved);
    handleReorder(newOrder);
  };

  if (!mounted) {
    return (
      <div className="flex flex-col gap-6">
        <PortfolioSummaryCards />
        <PnLWidget />
        <PortfolioAllocationChart />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-border/40 pb-2">
        <span className="text-xs font-semibold text-foreground-muted uppercase tracking-wider">
          Dashboard Widgets
        </span>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 text-xs text-foreground-subtle hover:text-foreground hover:bg-white/5 px-2 py-1 rounded transition-colors"
          title="Reset layout to default order"
        >
          <RotateCcw size={12} />
          Reset Layout
        </button>
      </div>

      <Reorder.Group
        axis="y"
        values={order}
        onReorder={handleReorder}
        className="flex flex-col gap-6"
      >
        {order.map((widgetId, index) => {
          return (
            <WidgetWrapper
              key={widgetId}
              widgetId={widgetId}
              index={index}
              totalItems={order.length}
              onMove={moveItem}
            >
              {widgetId === "summary" && <PortfolioSummaryCards />}
              {widgetId === "pnl" && <PnLWidget />}
              {widgetId === "allocation" && <PortfolioAllocationChart />}
            </WidgetWrapper>
          );
        })}
      </Reorder.Group>
    </div>
  );
}

interface WidgetWrapperProps {
  widgetId: string;
  index: number;
  totalItems: number;
  onMove: (index: number, direction: "up" | "down") => void;
  children: React.ReactNode;
}

function WidgetWrapper({ widgetId, index, totalItems, onMove, children }: WidgetWrapperProps) {
  const dragControls = useDragControls();

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      onMove(index, "up");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      onMove(index, "down");
    }
  };

  const title =
    widgetId === "summary"
      ? "Portfolio Summary"
      : widgetId === "pnl"
      ? "P&L Overview"
      : "Portfolio Allocation";

  return (
    <Reorder.Item
      value={widgetId}
      dragListener={false}
      dragControls={dragControls}
      className="relative focus-within:ring-2 focus-within:ring-sky-500 rounded-xl outline-none"
    >
      <div
        tabIndex={0}
        onKeyDown={handleKeyDown}
        aria-label={`${title} widget. Press Arrow Up or Down to reorder.`}
        className="group relative"
      >
        {/* Drag handle overlaid at top-left hover / focus */}
        <div className="absolute left-2 top-2 z-10 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-slate-900/90 rounded-md px-1.5 py-1 border border-white/10 shadow-md">
          <div
            onPointerDown={(e) => dragControls.start(e)}
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-200"
            title="Drag to reorder"
          >
            <GripVertical size={13} />
          </div>
          <div className="flex flex-col text-[8px] text-slate-500 leading-none pr-0.5 select-none">
            <span>▲/▼ keys</span>
            <span>to reorder</span>
          </div>
        </div>
        {children}
      </div>
    </Reorder.Item>
  );
}
