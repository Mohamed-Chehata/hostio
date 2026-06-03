import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export function BottomSheet({ title, description, onClose, children, externalClosing = false, lifted = false }) {
  const sheetRef = useRef(null);
  const dragStart = useRef(null);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  function close() {
    if (closing) return;
    setClosing(true);
    setTimeout(onClose, 400);
  }

  function dragStartSheet(event) {
    dragStart.current = event.clientY;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function dragSheet(event) {
    if (dragStart.current === null) return;
    const distance = Math.max(0, event.clientY - dragStart.current);
    sheetRef.current.style.transform = `translateY(${distance}px)`;
    sheetRef.current.style.transition = "none";
  }

  function dragEnd() {
    if (dragStart.current === null) return;
    const sheet = sheetRef.current;
    const distance = new DOMMatrix(getComputedStyle(sheet).transform).m42;
    dragStart.current = null;
    sheet.style.transition = "";
    sheet.style.transform = "";
    if (distance > sheet.offsetHeight * 0.4) close();
  }

  return createPortal(
    <div
      className={`sheet-backdrop fixed inset-0 z-50 flex items-end justify-center px-3 ${lifted ? "pb-[max(76px,env(safe-area-inset-bottom))]" : ""} ${closing || externalClosing ? "sheet-backdrop-closing" : ""}`}
      onClick={close}
    >
      <section ref={sheetRef} className={`bottom-sheet w-full max-w-[390px] overflow-y-auto rounded-t-[28px] bg-[#202020] px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-3 shadow-2xl ${lifted ? "max-h-[calc(100vh-96px)] rounded-b-[28px]" : "max-h-[92vh]"} ${closing || externalClosing ? "bottom-sheet-closing" : ""}`} onClick={(event) => event.stopPropagation()}>
        <div className="flex min-h-11 touch-none items-center justify-center" onPointerDown={dragStartSheet} onPointerMove={dragSheet} onPointerUp={dragEnd} onPointerCancel={dragEnd}>
          <div className="h-1 w-10 rounded-full bg-white/25" />
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold">{title}</h2>
            {description && <p className="mt-1 text-sm leading-5 text-muted">{description}</p>}
          </div>
          <button aria-label="Close sheet" onClick={close} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-white/5 text-muted transition hover:bg-white/10">
            <X size={17} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
      </section>
    </div>,
    document.body
  );
}
