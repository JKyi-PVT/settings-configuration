// 03/30/2026 10:00 MST

import { useState, useRef } from "react";

export function useUndoRedo(onRestore) {
    const onRestoreRef = useRef(onRestore);
    onRestoreRef.current = onRestore;

    const [undoStack, setUndoStack] = useState([]);
    const [redoStack, setRedoStack] = useState([]);
    const [current, setCurrent] = useState(null);
    const [pendingUndo, setPendingUndo] = useState(null);

    function initState(snapshot) {
        setCurrent(snapshot);
    }

    function pushState(snapshot) {
        if (current !== null) {
            setUndoStack(prev => [...prev, current]);
        }
        setCurrent(snapshot);
        setRedoStack([]);
    }

    function resetHistory() {
        setUndoStack([]);
        setRedoStack([]);
        setCurrent(null);
    }

    function undo() {
        if (undoStack.length === 0) return;
        const previous = undoStack[undoStack.length - 1];
        setPendingUndo({ from: current, to: previous });
    }

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
        resetHistory,
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