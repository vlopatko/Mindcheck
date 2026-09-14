"use client";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
export function TriCheck({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (v: boolean | null) => void;
}) {
  return (
    <label className={"check-row " + (value === true ? "checked" : "")}>
      <Checkbox
        aria-label={label}
        checked={value === null ? "indeterminate" : value}
        onCheckedChange={() =>
          onChange(value === null ? true : value ? false : null)
        }
      />
      <span>{label}</span>
      <small>{value === null ? "not logged" : value ? "yes" : "no"}</small>
    </label>
  );
}
export function Choice({
  label,
  value,
  onChange,
  options,
  placeholder = "Not logged",
}: {
  label: string;
  value: string | null;
  onChange: (v: string | null) => void;
  options: [string, string][];
  placeholder?: string;
}) {
  return (
    <Select
      value={value || "_none"}
      onValueChange={(v) => onChange(v === "_none" ? null : v)}
    >
      <SelectTrigger aria-label={label} className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="_none">{placeholder}</SelectItem>
        {options.map(([id, text]) => (
          <SelectItem key={id} value={id}>
            {text}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  max,
  min,
  step = 1,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label>
      {label}
      <input
        aria-label={label}
        type="number"
        step={step}
        min={min}
        max={max}
        placeholder="—"
        value={value ?? ""}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
}
