import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatRwf, toRwf, USD_TO_RWF_RATE, type EntryCurrency } from "@/lib/currency";

interface CurrencyAmountFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  currency: EntryCurrency;
  onCurrencyChange: (currency: EntryCurrency) => void;
  min?: number;
  step?: number | string;
  required?: boolean;
}

export default function CurrencyAmountField({
  label,
  value,
  onChange,
  currency,
  onCurrencyChange,
  min = 0,
  step = "0.01",
  required = false,
}: CurrencyAmountFieldProps) {
  const amount = Number(value) || 0;

  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="grid grid-cols-[minmax(0,1fr)_104px] gap-2">
        <Input
          type="number"
          min={min}
          step={step}
          required={required}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <Select value={currency} onValueChange={onCurrencyChange}>
          <SelectTrigger aria-label={`${label} currency`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="RWF">RWF</SelectItem>
            <SelectItem value="USD">USD</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <p className="text-xs text-muted-foreground">
        {currency === "USD"
          ? `Stored as ${formatRwf(toRwf(amount, currency))} (1 USD = ${USD_TO_RWF_RATE.toLocaleString()} RWF)`
          : `Stored as ${formatRwf(amount)}`}
      </p>
    </div>
  );
}