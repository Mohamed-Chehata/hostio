import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { BottomSheet } from "./BottomSheet";
import { Button, Input } from "./ui";

export function PropertySelectorSheet({ properties, activePropertyId, onSelect, onAdd, onRename, onRequestDelete, onClose }) {
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState("");
  const longPressTimer = useRef(null);

  function startEdit(property) {
    setEditingId(property.id);
    setDraft(property.name);
  }

  function saveEdit(property) {
    const next = draft.trim();
    if (next && next.length <= 100) onRename(property.id, next);
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraft("");
  }

  function startLongPress(property) {
    clearTimeout(longPressTimer.current);
    longPressTimer.current = setTimeout(() => onRequestDelete(property), 500);
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer.current);
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
            className="flex min-h-14 items-center gap-2 rounded-2xl bg-white/[0.04] px-3"
          >
            {editingId === property.id ? (
              <>
                <Input autoFocus maxLength={100} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => {
                  if (event.key === "Enter") saveEdit(property);
                  if (event.key === "Escape") cancelEdit();
                }} />
                <button aria-label="Save property name" onClick={() => saveEdit(property)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-accent"><Check size={17} /></button>
                <button aria-label="Cancel property rename" onClick={cancelEdit} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-muted"><X size={17} /></button>
              </>
            ) : (
              <>
                <button onClick={() => onSelect(property.id)} className="flex min-h-14 min-w-0 flex-1 items-center justify-between gap-3 text-left">
                  <span className="truncate text-sm font-extrabold">{property.name}</span>
                  {property.id === activePropertyId && <Check size={17} className="shrink-0 text-accent" />}
                </button>
                <button aria-label={`Rename ${property.name}`} onClick={() => startEdit(property)} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-muted"><Pencil size={15} /></button>
              </>
            )}
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
        <Button disabled={!valid} className="w-full py-4 disabled:opacity-50" type="submit">Add</Button>
      </form>
    </BottomSheet>
  );
}

export function DeletePropertySheet({ property, onCancel, onConfirm }) {
  if (!property) return null;
  return (
    <BottomSheet title="" onClose={onCancel}>
      <div className="text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-red-500/15 text-red-300">
          <Trash2 size={24} />
        </div>
        <h2 className="mt-4 text-xl font-extrabold">Delete property?</h2>
        <p className="mt-2 text-sm leading-5 text-muted">This will permanently remove "{property.name}" and its data.</p>
        <div className="mt-6 space-y-3">
          <Button variant="danger" onClick={onConfirm} className="w-full bg-red-500 text-white hover:bg-red-500">Delete</Button>
          <Button variant="ghost" onClick={onCancel} className="w-full text-muted">Cancel</Button>
        </div>
      </div>
    </BottomSheet>
  );
}
