import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Check, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Button, Input } from "./ui";

export function PropertySelectorSheet({ properties, activePropertyId, deletingProperty, onSelect, onAdd, onAction, onClose }) {
  const longPressTimer = useRef(null);
  const longPressed = useRef(false);

  function startLongPress(property) {
    clearTimeout(longPressTimer.current);
    longPressed.current = false;
    longPressTimer.current = setTimeout(() => {
      longPressed.current = true;
      onAction(property);
    }, 500);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
  }

  function selectProperty(property) {
    if (longPressed.current) {
      longPressed.current = false;
      return;
    }
    onSelect(property.id);
  }

  useEffect(() => () => clearTimeout(longPressTimer.current), []);

  return (
    <BottomSheet title="My Properties" onClose={onClose}>
      <div className="space-y-2">
        {properties.map((property) => (
          <div
            key={property.id}
            onPointerDown={() => startLongPress(property)}
            onPointerUp={cancelLongPress}
            onPointerCancel={cancelLongPress}
            onPointerLeave={cancelLongPress}
            className={`flex min-h-14 items-center gap-2 overflow-hidden rounded-2xl px-3 transition-[height,min-height,opacity,padding,background-color] ${
              deletingProperty?.id === property.id && deletingProperty.phase === "flash"
                ? "bg-red-500/[0.12] duration-150"
                : deletingProperty?.id === property.id && deletingProperty.phase === "collapse"
                  ? "h-0 min-h-0 bg-red-500/[0.12] px-0 opacity-0 duration-300 ease-in-out"
                  : "bg-white/[0.04] duration-300"
            }`}
          >
            <button onClick={() => selectProperty(property)} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 text-left">
              <span className="truncate text-sm font-extrabold">{property.name}</span>
              {property.id === activePropertyId && <Check size={17} className="shrink-0 text-accent" />}
            </button>
          </div>
        ))}
        <button onClick={onAdd} className="flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left text-sm font-extrabold text-accent">
          <Plus size={18} />
          Add property
        </button>
      </div>
    </BottomSheet>
  );
}

export function PropertyActionSheet({ property, onRename, onConfirmDelete, onClose }) {
  const [view, setView] = useState("actions");
  const [transitioningTo, setTransitioningTo] = useState(null);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [renameDraft, setRenameDraft] = useState(property.name);
  const originalName = property.name.trim();
  const trimmedRename = renameDraft.trim();
  const renameValid = trimmedRename.length > 0 && trimmedRename.length <= 100 && trimmedRename !== originalName;

  function showView(nextView) {
    if (transitioningTo) return;
    setTransitioningTo(nextView);
    setTimeout(() => {
      setView(nextView);
      setTransitioningTo(null);
    }, 150);
  }

  function showConfirmation() {
    showView("confirmation");
  }

  function showRename() {
    setRenameDraft(property.name);
    showView("rename");
  }

  function showActions() {
    if (transitioningTo) return;
    setTransitioningTo("actions");
    setTimeout(() => {
      setView("actions");
      setTransitioningTo(null);
    }, 150);
  }

  async function confirmDelete() {
    if (closing || deleting) return;
    setDeleting(true);
    const deleted = await onConfirmDelete();
    if (!deleted) {
      setDeleting(false);
      return;
    }
    setClosing(true);
    setTimeout(onClose, 400);
  }

  async function saveRename(event) {
    event.preventDefault();
    if (!renameValid || closing) return;
    const renamed = await onRename(trimmedRename);
    if (!renamed) return;
    setClosing(true);
    setTimeout(onClose, 400);
  }

  return (
    <BottomSheet title={property.name} onClose={onClose} externalClosing={closing}>
      {view === "actions" ? (
        <div className={`space-y-2 ${transitioningTo ? "animate-property-actions-exit" : "animate-property-actions-enter"}`}>
          <button onClick={showRename} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-white/[0.04] px-4 text-left text-sm font-extrabold text-white">
            <Pencil size={18} />
            Rename property
          </button>
          <button onClick={showConfirmation} className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-red-500/[0.08] px-4 text-left text-sm font-extrabold text-[#EF4444]">
            <Trash2 size={18} />
            Delete property
          </button>
          <button onClick={onClose} className="min-h-14 w-full rounded-2xl text-sm font-extrabold text-muted">
            Cancel
          </button>
        </div>
      ) : view === "confirmation" ? (
        <div className={transitioningTo === "actions" ? "animate-property-confirmation-exit" : "animate-property-confirmation-enter"}>
          <button onClick={showActions} aria-label="Back to property actions" className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-muted">
            <ArrowLeft size={18} />
          </button>
          <div className="text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-red-300">
              <Trash2 size={24} />
            </div>
            <h2 className="mt-4 text-xl font-extrabold">Delete {property.name}?</h2>
            <p className="mt-2 text-sm leading-5 text-muted">All bookings, expenses and costs for this property will be permanently deleted.</p>
            <div className="mt-6 space-y-3">
              <Button disabled={deleting} variant="danger" onClick={confirmDelete} className="w-full bg-red-500 text-[#FFFFFF] hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-70">
                {deleting ? <LoaderCircle className="mx-auto animate-spin" size={19} /> : "Delete"}
              </Button>
              <Button variant="ghost" onClick={showActions} className="w-full text-muted">Cancel</Button>
            </div>
          </div>
        </div>
      ) : (
        <form onSubmit={saveRename} className={transitioningTo === "actions" ? "animate-property-rename-exit" : "animate-property-rename-enter"}>
          <button type="button" onClick={showActions} aria-label="Back to property actions" className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-white/5 text-muted">
            <ArrowLeft size={18} />
          </button>
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Property name</span>
            <Input autoFocus maxLength={100} value={renameDraft} onChange={(event) => setRenameDraft(event.target.value)} />
          </label>
          <Button
            disabled={!renameValid}
            className={`mt-4 w-full py-4 transition-[opacity,transform] duration-300 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${renameValid ? "animate-auth-button-ready" : ""}`}
            type="submit"
          >
            Save
          </Button>
        </form>
      )}
    </BottomSheet>
  );
}

export function AddPropertySheet({ onClose, onSave }) {
  const [name, setName] = useState("");
  const valid = name.trim().length > 0 && name.trim().length <= 100;

  function submit(event) {
    event.preventDefault();
    if (!valid) return;
    onSave(name.trim());
  }

  return (
    <BottomSheet title="Add property" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-muted">Property name</span>
          <Input autoFocus maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. La Montagne" />
        </label>
        <Button disabled={!valid} className="w-full py-4 disabled:opacity-40" type="submit">Add</Button>
      </form>
    </BottomSheet>
  );
}

export function PropertyDeletedSheet({ property, onComplete }) {
  const [complete, setComplete] = useState(false);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    const morphTimer = setTimeout(() => setComplete(true), 400);
    const closeTimer = setTimeout(() => setClosing(true), 2000);
    const completeTimer = setTimeout(onComplete, 2400);
    return () => {
      clearTimeout(morphTimer);
      clearTimeout(closeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <BottomSheet title="" onClose={() => {}} externalClosing={closing}>
      <div className="pb-4 text-center">
        <div className="relative mx-auto h-16 w-16">
          <div className={`absolute inset-0 grid place-items-center rounded-full bg-red-500 text-[#FFFFFF] transition-opacity duration-400 ${complete ? "opacity-0" : "opacity-100"}`}>
            <Trash2 size={25} />
          </div>
          <div className={`absolute inset-0 grid place-items-center rounded-full bg-emerald-500 text-[#FFFFFF] transition-opacity duration-400 ${complete ? "opacity-100" : "opacity-0"}`}>
            <Check size={28} strokeWidth={3} />
          </div>
        </div>
        <h2 className="mt-5 text-xl font-extrabold text-white">Property deleted</h2>
        <p className="mt-2 text-sm leading-5 text-muted">All data for {property.name} has been removed</p>
      </div>
    </BottomSheet>
  );
}
