'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

const STATUS_OPTIONS = [
  { value: 'PENDING', label: 'Pending' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
] as const;

interface StatusDropdownProps {
  value: string;
  onChange: (newStatus: string) => void;
}

export default function StatusDropdown({ value, onChange }: StatusDropdownProps) {
  const statusColors: Record<string, string> = {
    PENDING: 'bg-muted text-muted-foreground',
    IN_PROGRESS: 'bg-[var(--color-warning)]/10 text-[var(--color-warning)]',
    DONE: 'bg-[var(--color-success)]/10 text-[var(--color-success)]',
    CANCELLED: 'bg-destructive/10 text-destructive',
  };

  return (
    <Select value={value} onValueChange={(val) => onChange(val || '')}>
      <SelectTrigger className="w-[140px] h-8 text-xs border-transparent hover:border-border">
        <Badge variant="secondary" className={`${statusColors[value] || ''} text-xs`}>
          {STATUS_OPTIONS.find(s => s.value === value)?.label || value}
        </Badge>
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((s) => (
          <SelectItem key={s.value} value={s.value}>
            {s.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
