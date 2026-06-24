"use client";

import { useState } from "react";
import { Clock } from "lucide-react";
import ClockTimePicker from "./ClockTimePicker";

interface Props {
  value: string;                 // "HH:MM" 24-h, "" = empty
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  label?: string;                // dialog heading, e.g. "Deadline time"
}

/**
 * Trigger field for the analog ClockTimePicker — mirrors DatePicker's trigger so
 * a date + time pair lines up. Clicking opens the centered clock dialog.
 */
export default function TimeField({
  value,
  onChange,
  disabled,
  placeholder = "Select time",
  label,
}: Props) {
  const [open, setOpen] = useState(false);

  const triggerCls = `w-full flex items-center gap-0 rounded-[8px] border bg-[#F8FAFC] text-left text-[15px] transition-colors ${
    disabled
      ? "border-[#E2E8F0] cursor-not-allowed opacity-70"
      : "border-[#CBD5E1] cursor-pointer hover:bg-white hover:border-[#94A3B8]"
  } ${open ? "!bg-white !border-[#2563EB] ring-1 ring-[#2563EB]" : ""}`;

  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={triggerCls}>
        <span className="flex items-center px-2.5 py-2.5 border-r border-[#E2E8F0] rounded-l-[8px] text-[#64748B]">
          <Clock size={15} />
        </span>
        <span className={`flex-1 px-3 py-2.5 truncate ${value ? "text-[#0F172A]" : "text-[#94A3B8]"}`}>
          {value || placeholder}
        </span>
      </button>

      {open && (
        <ClockTimePicker
          value={value || "09:00"}
          label={label}
          onChange={onChange}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
