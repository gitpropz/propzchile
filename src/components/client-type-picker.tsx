import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ACCOUNT_LABELS, CLIENT_TYPES, isClientType, type ClientType } from "@/lib/account-types";
export function ClientTypePicker({ value, onChange }: { value: ClientType; onChange: (value: ClientType) => void }) {
  return <RadioGroup aria-label="Tipo de cuenta" value={value} onValueChange={(next) => { if (isClientType(next)) onChange(next); }}>
    {CLIENT_TYPES.map((type) => <div className="flex items-center gap-3 py-1" key={type}>
      <RadioGroupItem id={`account-${type}`} value={type} />
      <Label htmlFor={`account-${type}`} className="cursor-pointer">{ACCOUNT_LABELS[type]}</Label>
    </div>)}
  </RadioGroup>;
}