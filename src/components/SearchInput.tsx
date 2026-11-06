import type { ComponentProps } from "react";
import { Search, LoaderCircle } from "lucide-react";
import { Input } from "@/components/ui/input";

interface SearchInputProps extends ComponentProps<"input"> {
  isSearching?: boolean;
}

export default function SearchInput({ isSearching = false, className, ...props }: SearchInputProps) {
  return (
    <div className="relative">
      {isSearching
        ? <LoaderCircle className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-primary" aria-hidden="true" />
        : <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />}
      <Input
        {...props}
        aria-busy={isSearching || undefined}
        className={`pl-9 ${className ?? ""}`}
      />
    </div>
  );
}
