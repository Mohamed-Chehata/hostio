import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils";

export function AnimatedNumber({ value, direction = null, format, className, animationKey, previousValue: animatedFrom }) {
  const previousValueRef = useRef(value);
  const lastAnimationKey = useRef(animationKey);
  const [animation, setAnimation] = useState(null);

  useEffect(() => {
    if (animationKey && animationKey !== lastAnimationKey.current && animatedFrom !== undefined && animatedFrom !== value && direction) {
      lastAnimationKey.current = animationKey;
      previousValueRef.current = value;
      setAnimation({ previous: animatedFrom, current: value, direction });
      const clear = setTimeout(() => setAnimation(null), 700);
      return () => clearTimeout(clear);
    }
    lastAnimationKey.current = animationKey;
    if (previousValueRef.current === value) return;
    const previous = previousValueRef.current;
    previousValueRef.current = value;
    if (!direction) {
      setAnimation(null);
      return;
    }
    setAnimation({ previous, current: value, direction });
    const clear = setTimeout(() => setAnimation(null), 700);
    return () => clearTimeout(clear);
  }, [value, direction, animationKey, animatedFrom]);

  const current = format(value);
  return (
    <span className={cn("relative inline-grid overflow-hidden align-bottom", className)}>
      <span className="invisible col-start-1 row-start-1">{current}</span>
      {animation ? (
        <>
          <span className={cn("absolute inset-0", animation.direction === "up" ? "animate-number-exit-up" : "animate-number-exit-down")}>{format(animation.previous)}</span>
          <span className={cn("absolute inset-0", animation.direction === "up" ? "animate-number-enter-up" : "animate-number-enter-down")}>{format(animation.current)}</span>
        </>
      ) : <span className="absolute inset-0">{current}</span>}
    </span>
  );
}
