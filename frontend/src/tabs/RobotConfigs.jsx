// 03/20/2026 10:00 MST

import { useState, useEffect, useRef } from "react";
import { connectRobots, setPayloadDetection, updateSpeed } from "../api";
import { useUndoRedo } from "../hooks/UseUndoRedo";
import ConfirmModal from "../components/ConfirmModal";

function computeDiff(from, to) {
    const changes = [];
    if (from.speed !== to.speed) {
        changes.push({ label: "Robot Speed", from: String(from.speed), to: String(to.speed) });
    }
    const allRobots = new Set([
        ...Object.keys(from.payloadState || {}),
        ...Object.keys(to.payloadState || {}),
    ]);
    allRobots.forEach((robotId) => {
        const fromVal = (from.payloadState || {})[robotId];
        const toVal = (to.payloadState || {})[robotId];
        if (fromVal !== undefined && toVal !== undefined && fromVal !== toVal) {
            changes.push({
                label: `Robot ${robotId} Payload Detection`,
                from: fromVal ? "On" : "Off",
                to: toVal ? "On" : "Off",
            });
        }
    });
    return changes;
}

export default function RobotConfigs({ maxVelocity, onHistoryChange }) {
    const [connectedRobots, setConnectedRobots] = useState([]);
    const [failedRobots, setFailedRobots] = useState([]);
    const [selectedRobots, setSelectedRobots] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [speed, setSpeed] = useState(maxVelocity ?? 1.0);
    const [payloadState, setPayloadState] = useState({});

    const [connectStatus, setConnectStatus] = useState(null);
    const [payloadStatus, setPayloadStatus] = useState(null);
    const [speedStatus, setSpeedStatus] = useState(null);
    const [restoreStatus, setRestoreStatus] = useState(null);
    const [connectLoading, setConnectLoading] = useState(false);

    const initialized = useRef(false);

    async function onRestore(snapshot) {
        setRestoreStatus(null);
        try {
            setSpeed(snapshot.speed);
            await updateSpeed(snapshot.speed);

            const ps = snapshot.payloadState || {};
            const turnOnRobots = Object.entries(ps).filter(([, v]) => v).map(([k]) => parseInt(k));
            const turnOffRobots = Object.entries(ps).filter(([, v]) => !v).map(([k]) => parseInt(k));
            if (turnOnRobots.length > 0) await setPayloadDetection(true, turnOnRobots);
            if (turnOffRobots.length > 0) await setPayloadDetection(false, turnOffRobots);
            setPayloadState(ps);

            setRestoreStatus({ ok: true, msg: "Reverted successfully." });
        } catch (e) {
            setRestoreStatus({ ok: false, msg: e.message });
        }
    }

    const {
        initState,
        pushState,
        undo,
        redo,
        canUndo,
        canRedo,
        pendingUndo,
        confirmUndo,
        cancelUndo,
        hasHistory,
    } = useUndoRedo(onRestore);

    // Initialize baseline snapshot on first render
    useEffect(() => {
        if (!initialized.current) {
            initState({ speed: maxVelocity ?? 1.0, payloadState: {} });
            initialized.current = true;
        }
    }, []);

    // Notify App.jsx when history presence changes
    useEffect(() => {
        onHistoryChange(hasHistory);
    }, [hasHistory]);

    function currentSnapshot() {
        return { speed, payloadState: { ...payloadState } };
    }

    async function handleConnectRobots() {
        setConnectLoading(true);
        setConnectStatus(null);
        try {
            const data = await connectRobots();
            setConnectedRobots(data.connected);
            setFailedRobots(data.failed);
            setSelectedRobots([]);
            setSelectAll(false);
            setConnectStatus({ ok: true, msg: `Connected: ${data.connected.length} robot(s). Failed: ${data.failed.length}.` });
        } catch (e) {
            setConnectStatus({ ok: false, msg: e.message });
        } finally {
            setConnectLoading(false);
        }
    }

    function handleSelectAll(checked) {
        setSelectAll(checked);
        if (checked) {
            setSelectedRobots(connectedRobots.map((ip) => extractRobotId(ip)));
        } else {
            setSelectedRobots([]);
        }
    }

    function handleSelectRobot(id, checked) {
        setSelectedRobots((prev) => {
            const updated = checked ? [...prev, id] : prev.filter((r) => r !== id);
            setSelectAll(updated.length === connectedRobots.length);
            return updated;
        });
    }

    function extractRobotId(ip) {
        return parseInt(ip.split(".")[3]) - 30;
    }

    async function handlePayloadDetection(turnOn) {
        setPayloadStatus(null);
        try {
            await setPayloadDetection(turnOn, selectedRobots);
            const updatedPs = { ...payloadState };
            selectedRobots.forEach((id) => { updatedPs[id] = turnOn; });
            setPayloadState(updatedPs);
            pushState({ speed, payloadState: updatedPs });
            setPayloadStatus({ ok: true, msg: `Payload detection turned ${turnOn ? "on" : "off"}.` });
        } catch (e) {
            setPayloadStatus({ ok: false, msg: e.message });
        }
    }

    async function handleSaveSpeed() {
        setSpeedStatus(null);
        try {
            await updateSpeed(speed);
            pushState(currentSnapshot());
            setSpeedStatus({ ok: true, msg: "Saved." });
        } catch (e) {
            setSpeedStatus({ ok: false, msg: e.message });
        }
    }

    const diffChanges = pendingUndo ? computeDiff(pendingUndo.from, pendingUndo.to) : null;

    return (
        <div style={styles.wrapper}>
            <ConfirmModal
                changes={diffChanges}
                onConfirm={confirmUndo}
                onCancel={cancelUndo}
            />

            <div style={styles.toolbar}>
                <h2 style={styles.header}>Robot Configurations</h2>
                <div style={styles.historyBtns}>
                    <button
                        onClick={undo}
                        disabled={!canUndo}
                        style={{ ...styles.historyBtn, ...(canUndo ? {} : styles.historyBtnDisabled) }}
                        title="Undo"
                    >
                        ↩ Undo
                    </button>
                    <button
                        onClick={redo}
                        disabled={!canRedo}
                        style={{ ...styles.historyBtn, ...(canRedo ? {} : styles.historyBtnDisabled) }}
                        title="Redo"
                    >
                        Redo ↪
                    </button>
                </div>
            </div>

            {restoreStatus && (
                <p style={{ ...styles.status, color: restoreStatus.ok ? "green" : "#c0392b", marginBottom: "12px" }}>
                    {restoreStatus.msg}
                </p>
            )}

            {/* Connect to Robots */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Connect to Robots</h3>
                <button onClick={handleConnectRobots} disabled={connectLoading} style={styles.button}>
                    {connectLoading ? "Connecting..." : "Connect to Robots"}
                </button>
                {connectStatus && (
                    <p style={{ ...styles.status, color: connectStatus.ok ? "green" : "#c0392b" }}>
                        {connectStatus.msg}
                    </p>
                )}
                {failedRobots.length > 0 && (
                    <p style={{ ...styles.status, color: "#c0392b" }}>
                        Failed: {failedRobots.join(", ")}
                    </p>
                )}
            </div>

            {/* Select Robots */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Select Robots</h3>
                {connectedRobots.length === 0 ? (
                    <p style={styles.dimText}>No robots connected yet.</p>
                ) : (
                    <>
                        <div style={styles.checkRow}>
                            <input
                                type="checkbox"
                                checked={selectAll}
                                onChange={(e) => handleSelectAll(e.target.checked)}
                                id="select-all"
                            />
                            <label htmlFor="select-all" style={styles.checkLabel}>Select all robots</label>
                        </div>
                        {connectedRobots.map((ip) => {
                            const id = extractRobotId(ip);
                            return (
                                <div key={ip} style={styles.checkRow}>
                                    <input
                                        type="checkbox"
                                        checked={selectedRobots.includes(id)}
                                        onChange={(e) => handleSelectRobot(id, e.target.checked)}
                                        id={`robot-${id}`}
                                    />
                                    <label htmlFor={`robot-${id}`} style={styles.checkLabel}>
                                        Robot {id} ({ip})
                                        {payloadState[id] !== undefined && (
                                            <span style={styles.payloadBadge}>
                                                Payload: {payloadState[id] ? "On" : "Off"}
                                            </span>
                                        )}
                                    </label>
                                </div>
                            );
                        })}
                    </>
                )}
            </div>

            {/* Payload Detection */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Payload Detection</h3>
                <div style={styles.buttonRow}>
                    <button
                        onClick={() => handlePayloadDetection(true)}
                        disabled={selectedRobots.length === 0}
                        style={styles.button}
                    >
                        Turn On
                    </button>
                    <button
                        onClick={() => handlePayloadDetection(false)}
                        disabled={selectedRobots.length === 0}
                        style={styles.buttonOutline}
                    >
                        Turn Off
                    </button>
                </div>
                {payloadStatus && (
                    <p style={{ ...styles.status, color: payloadStatus.ok ? "green" : "#c0392b" }}>
                        {payloadStatus.msg}
                    </p>
                )}
            </div>

            {/* Adjust Robot Speed */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Adjust Robot Speed</h3>
                <div style={styles.row}>
                    <label style={styles.label}>Speed: {speed.toFixed(2)}</label>
                    <input
                        type="range"
                        min={0.5}
                        max={1.5}
                        step={0.01}
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                        style={styles.slider}
                    />
                </div>
                <button onClick={handleSaveSpeed} style={styles.button}>Set Speed</button>
                {speedStatus && (
                    <p style={{ ...styles.status, color: speedStatus.ok ? "green" : "#c0392b" }}>
                        {speedStatus.msg}
                    </p>
                )}
            </div>
        </div>
    );
}

const styles = {
    wrapper: {
        fontFamily: "sans-serif",
        maxWidth: "700px",
        width: "100%",
    },
    toolbar: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "2px solid #c0392b",
        paddingBottom: "8px",
        marginBottom: "24px",
    },
    header: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#c0392b",
        margin: 0,
    },
    historyBtns: {
        display: "flex",
        gap: "8px",
    },
    historyBtn: {
        padding: "6px 14px",
        fontSize: "13px",
        backgroundColor: "#3498db",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "600",
    },
    historyBtnDisabled: {
        backgroundColor: "#ccc",
        cursor: "not-allowed",
    },
    section: {
        marginBottom: "32px",
        padding: "20px",
        backgroundColor: "#fff",
        borderRadius: "8px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
    },
    sectionTitle: {
        fontSize: "16px",
        fontWeight: "600",
        marginBottom: "16px",
        marginTop: 0,
        color: "#333",
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: "12px",
    },
    buttonRow: {
        display: "flex",
        gap: "12px",
    },
    label: {
        fontSize: "14px",
        color: "#444",
        minWidth: "120px",
    },
    slider: {
        flex: 1,
        accentColor: "#c0392b",
    },
    button: {
        padding: "8px 16px",
        fontSize: "14px",
        backgroundColor: "#c0392b",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    buttonOutline: {
        padding: "8px 16px",
        fontSize: "14px",
        backgroundColor: "#fff",
        color: "#c0392b",
        border: "1px solid #c0392b",
        borderRadius: "4px",
        cursor: "pointer",
    },
    status: {
        fontSize: "13px",
        marginTop: "8px",
    },
    checkRow: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
        marginBottom: "8px",
    },
    checkLabel: {
        fontSize: "14px",
        color: "#444",
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    payloadBadge: {
        fontSize: "11px",
        color: "#888",
        backgroundColor: "#f0f0f0",
        padding: "2px 6px",
        borderRadius: "10px",
    },
    dimText: {
        fontSize: "14px",
        color: "#999",
    },
};