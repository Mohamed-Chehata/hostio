import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export function MonthNavigator({
  label,
  onPrevious,
  onNext,
  previousDisabled = false,
  nextDisabled = false,
  previousLabel = "Previous month",
  nextLabel = "Next month",
  className,
  labelClassName,
  arrowClassName
}) {
  return (
    <div className={cn("flex items-center justify-between", className)}>
      <button
        type="button"
        aria-label={previousLabel}
        disabled={previousDisabled}
        onClick={onPrevious}
        className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-muted transition-opacity disabled:cursor-not-allowed disabled:opacity-30", arrowClassName)}
      >
        <ChevronLeft size={18} />
      </button>
      <div className={cn("min-w-[200px] flex-1 whitespace-nowrap text-center text-sm font-bold", labelClassName)}>{label}</div>
      <button
        type="button"
        aria-label={nextLabel}
        disabled={nextDisabled}
        onClick={onNext}
        className={cn("grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-muted transition-opacity disabled:cursor-not-allowed disabled:opacity-30", arrowClassName)}
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
