// 03/20/2026 10:00 MST

import { useState, useRef } from "react";

export function useUndoRedo(onRestore) {
    // Always keep the latest onRestore in a ref so confirmUndo/redo
    // never close over a stale version of it
    const onRestoreRef = useRef(onRestore);
    onRestoreRef.current = onRestore;

    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [current, setCurrent] = useState(null);
    const [pendingUndo, setPendingUndo] = useState(null);

    // Call once after configs are first loaded to establish the baseline
    // snapshot that the first save can be undone back to
    function initState(snapshot) {
        setCurrent(snapshot);
    }

    // Call after every successful save
    function pushState(snapshot) {
        if (current !== null) {
            setUndoStack(prev => [...prev, current]);
        }
        setCurrent(snapshot);
        setRedoStack([]);
    }

    // Opens the confirmation modal — does not restore yet
    function undo() {
        if (undoStack.length === 0) return;
        const previous = undoStack[undoStack.length - 1];
        setPendingUndo({ from: current, to: previous });
    }

    // Called when the user confirms the undo modal
    async function confirmUndo() {
        if (!pendingUndo) return;
        const previous = pendingUndo.to;
        setUndoStack(prev => prev.slice(0, -1));
        setRedoStack(prev => [...prev, current]);
        setCurrent(previous);
        setPendingUndo(null);
        await onRestoreRef.current(previous);
    }

    function cancelUndo() {
        setPendingUndo(null);
    }

    // Redo has no confirmation — it re-applies a previously undone save
    async function redo() {
        if (redoStack.length === 0) return;
        const next = redoStack[redoStack.length - 1];
        setRedoStack(prev => prev.slice(0, -1));
        setUndoStack(prev => [...prev, current]);
        setCurrent(next);
        await onRestoreRef.current(next);
    }

    return {
        initState,
        pushState,
        undo,
        redo,
        canUndo: undoStack.length > 0,
        canRedo: redoStack.length > 0,
        pendingUndo,
        confirmUndo,
        cancelUndo,
        hasHistory: undoStack.length > 0 || redoStack.length > 0,
    };
}