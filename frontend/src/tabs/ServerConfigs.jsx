// 03/20/2026 10:00 MST

import { useState, useEffect, useRef } from "react";
import { updateConfig, updateBarcodeSim } from "../api";
import { useUndoRedo } from "../hooks/UseUndoRedo";
import ConfirmModal from "../components/ConfirmModal";

function computeDiff(from, to) {
    const changes = [];
    if (from.timeout !== to.timeout) {
        changes.push({ label: "Infeed Timeout", from: `${from.timeout} sec`, to: `${to.timeout} sec` });
    }
    if (from.costLinear !== to.costLinear) {
        changes.push({ label: "Target Cost Linear", from: String(from.costLinear), to: String(to.costLinear) });
    }
    if (from.costQuad !== to.costQuad) {
        changes.push({ label: "Target Cost Quad", from: String(from.costQuad), to: String(to.costQuad) });
    }
    (from.simRanges || []).forEach((range, i) => {
        const toRange = (to.simRanges || [])[i];
        if (!toRange) return;
        if (range.start !== toRange.start || range.end !== toRange.end) {
            changes.push({
                label: `Simulator ${i + 1} Range`,
                from: `${range.start} – ${range.end}`,
                to: `${toRange.start} – ${toRange.end}`,
            });
        }
    });
    return changes;
}

function SimRangeSlider({ start, end, max, onChange }) {
    const lastActive = useRef("end");
    const low = Math.min(start, end);
    const high = Math.max(start, end);
    const lowPct = max > 0 ? (low / max) * 100 : 0;
    const highPct = max > 0 ? (high / max) * 100 : 0;
    return (
        <div style={sliderStyles.dualSliderWrapper}>
            <style>{`
                .dual-range-thumb {
                    position: absolute;
                    width: 100%;
                    height: 4px;
                    background: none;
                    pointer-events: none;
                    -webkit-appearance: none;
                    appearance: none;
                    outline: none;
                    top: 50%;
                    transform: translateY(-50%);
                    margin: 0;
                }
                .dual-range-thumb::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #3498db;
                    cursor: pointer;
                    pointer-events: all;
                    border: 2px solid #fff;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                }
                .dual-range-thumb::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #3498db;
                    cursor: pointer;
                    pointer-events: all;
                    box-shadow: 0 1px 4px rgba(0,0,0,0.2);
                    border: none;
                }
            `}</style>
            <div style={sliderStyles.dualSliderTrack}>
                <div style={sliderStyles.dualSliderTrackBg} />
                <div style={{ ...sliderStyles.dualSliderFill, left: `${lowPct}%`, width: `${highPct - lowPct}%` }} />
                <input
                    type="range"
                    min={0}
                    max={max}
                    step={1}
                    value={start}
                    className="dual-range-thumb"
                    style={{ zIndex: lastActive.current === "start" ? 2 : 1 }}
                    onPointerDown={() => { lastActive.current = "start"; }}
                    onChange={(e) => onChange("start", Number(e.target.value))}
                />
                <input
                    type="range"
                    min={0}
                    max={max}
                    step={1}
                    value={end}
                    className="dual-range-thumb"
                    style={{ zIndex: lastActive.current === "end" ? 2 : 1 }}
                    onPointerDown={() => { lastActive.current = "end"; }}
                    onChange={(e) => onChange("end", Number(e.target.value))}
                />
            </div>
            <div style={sliderStyles.dualSliderValues}>
                <span style={sliderStyles.sliderValue}>{low}</span>
                <span style={sliderStyles.sliderValue}>{high}</span>
            </div>
        </div>
    );
}

const sliderStyles = {
    dualSliderWrapper: {
        marginTop: "8px",
        marginBottom: "4px",
    },
    dualSliderTrack: {
        position: "relative",
        height: "20px",
        display: "flex",
        alignItems: "center",
    },
    dualSliderTrackBg: {
        position: "absolute",
        width: "100%",
        height: "4px",
        backgroundColor: "#e0e0e0",
        borderRadius: "2px",
    },
    dualSliderFill: {
        position: "absolute",
        height: "4px",
        backgroundColor: "#3498db",
        borderRadius: "2px",
    },
    dualSliderValues: {
        display: "flex",
        justifyContent: "space-between",
        marginTop: "4px",
    },
    sliderValue: {
        fontSize: "13px",
        fontWeight: "600",
        color: "#3498db",
        minWidth: "50px",
    },
};

export default function ServerConfigs({ configs, setConfigs, simulatorConfigs, setSimulatorConfigs, barcodeSimInstances, maxDestinations, onHistoryChange }) {
    const [timeout, setTimeout] = useState(configs?.["qb-ds"]?.["input_cell_deactivation_timeout"] ?? 30);
    const [costLinear, setCostLinear] = useState(configs?.["arq-gp"]?.["target_reservation_cost_linear"] ?? 0);
    const [costQuad, setCostQuad] = useState(configs?.["arq-gp"]?.["target_reservation_cost_quad"] ?? 0);
    const [simRanges, setSimRanges] = useState([]);

    const [timeoutStatus, setTimeoutStatus] = useState(null);
    const [loadBalanceStatus, setLoadBalanceStatus] = useState(null);
    const [simStatus, setSimStatus] = useState(null);
    const [restoreStatus, setRestoreStatus] = useState(null);

    const initialized = useRef(false);

    useEffect(() => {
        if (simulatorConfigs) {
            const ranges = [];
            for (let i = 0; i < barcodeSimInstances; i++) {
                ranges.push({
                    start: simulatorConfigs[i]?.range_start ?? 0,
                    end: simulatorConfigs[i]?.range_end ?? 0,
                });
            }
            setSimRanges(ranges);
        }
    }, [simulatorConfigs, barcodeSimInstances]);

    async function onRestore(snapshot) {
        setRestoreStatus(null);
        try {
            setTimeout(snapshot.timeout);
            setCostLinear(snapshot.costLinear);
            setCostQuad(snapshot.costQuad);
            setSimRanges(snapshot.simRanges);

            await updateConfig("qb-ds", "input_cell_deactivation_timeout", snapshot.timeout);
            setConfigs(prev => ({
                ...prev,
                "qb-ds": { ...prev["qb-ds"], input_cell_deactivation_timeout: snapshot.timeout },
            }));

            await updateConfig("arq-gp", "target_reservation_cost_linear", snapshot.costLinear);
            await updateConfig("arq-gp", "target_reservation_cost_quad", snapshot.costQuad);
            setConfigs(prev => ({
                ...prev,
                "arq-gp": {
                    ...prev["arq-gp"],
                    target_reservation_cost_linear: snapshot.costLinear,
                    target_reservation_cost_quad: snapshot.costQuad,
                },
            }));

            const updatedSimConfigs = { ...simulatorConfigs };
            for (let i = 0; i < snapshot.simRanges.length; i++) {
                updatedSimConfigs[i] = {
                    ...updatedSimConfigs[i],
                    range_start: snapshot.simRanges[i].start,
                    range_end: snapshot.simRanges[i].end,
                };
            }
            await updateBarcodeSim(updatedSimConfigs);
            setSimulatorConfigs(updatedSimConfigs);

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

    // Initialize baseline snapshot once simRanges are populated
    useEffect(() => {
        if (!initialized.current && simRanges.length > 0 && configs) {
            initState({
                timeout: configs["qb-ds"]["input_cell_deactivation_timeout"],
                costLinear: configs["arq-gp"]["target_reservation_cost_linear"],
                costQuad: configs["arq-gp"]["target_reservation_cost_quad"],
                simRanges: simRanges.map(r => ({ ...r })),
            });
            initialized.current = true;
        }
    }, [simRanges, configs]);

    // Notify App.jsx when history presence changes
    useEffect(() => {
        onHistoryChange(hasHistory);
    }, [hasHistory]);

    function currentSnapshot() {
        return {
            timeout,
            costLinear,
            costQuad,
            simRanges: simRanges.map(r => ({ ...r })),
        };
    }

    async function handleSaveTimeout() {
        setTimeoutStatus(null);
        try {
            await updateConfig("qb-ds", "input_cell_deactivation_timeout", timeout);
            setConfigs(prev => ({
                ...prev,
                "qb-ds": { ...prev["qb-ds"], input_cell_deactivation_timeout: timeout },
            }));
            pushState(currentSnapshot());
            setTimeoutStatus({ ok: true, msg: "Saved." });
        } catch (e) {
            setTimeoutStatus({ ok: false, msg: e.message });
        }
    }

    async function handleSaveLoadBalance() {
        setLoadBalanceStatus(null);
        try {
            await updateConfig("arq-gp", "target_reservation_cost_linear", costLinear);
            await updateConfig("arq-gp", "target_reservation_cost_quad", costQuad);
            setConfigs(prev => ({
                ...prev,
                "arq-gp": {
                    ...prev["arq-gp"],
                    target_reservation_cost_linear: costLinear,
                    target_reservation_cost_quad: costQuad,
                },
            }));
            pushState(currentSnapshot());
            setLoadBalanceStatus({ ok: true, msg: "Saved." });
        } catch (e) {
            setLoadBalanceStatus({ ok: false, msg: e.message });
        }
    }

    async function handleSaveSimRanges() {
        setSimStatus(null);
        try {
            const updated = { ...simulatorConfigs };
            for (let i = 0; i < barcodeSimInstances; i++) {
                updated[i] = { ...updated[i], range_start: simRanges[i].start, range_end: simRanges[i].end };
            }
            await updateBarcodeSim(updated);
            setSimulatorConfigs(updated);
            pushState(currentSnapshot());
            setSimStatus({ ok: true, msg: "Saved." });
        } catch (e) {
            setSimStatus({ ok: false, msg: e.message });
        }
    }

    function updateSimRange(index, field, value) {
        setSimRanges((prev) => {
            const updated = [...prev];
            updated[index] = { ...updated[index], [field]: Number(value) };
            return updated;
        });
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
                <h2 style={styles.header}>Server Configurations</h2>
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

            {/* Infeed Timeout */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Infeed Timeout</h3>
                <div style={styles.sectionSubtitle}>Time before an infeed station times out waiting for a package</div>
                <div style={styles.sliderRow}>
                    <span style={styles.sliderMin}>{10}sec</span>
                    <input
                        type="range"
                        min={10}
                        max={120}
                        step={0.5}
                        value={timeout}
                        onChange={(e) => setTimeout(Number(e.target.value))}
                        style={styles.slider}
                    />
                    <span style={styles.sliderValue}>{timeout} sec</span>
                </div>
                <button onClick={handleSaveTimeout} style={styles.button}>Set Infeed Timeout</button>
                {timeoutStatus && (
                    <p style={{ ...styles.status, color: timeoutStatus.ok ? "green" : "#c0392b" }}>
                        {timeoutStatus.msg}
                    </p>
                )}
            </div>

            {/* Load Balancing */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Load Balancing</h3>
                <div style={styles.row}>
                    <label style={styles.label}>Target cost linear</label>
                    <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.1}
                        value={costLinear}
                        onChange={(e) => setCostLinear(Number(e.target.value))}
                        style={styles.numberInput}
                    />
                </div>
                <div style={styles.row}>
                    <label style={styles.label}>Target cost quad</label>
                    <input
                        type="number"
                        min={0}
                        max={20}
                        step={0.1}
                        value={costQuad}
                        onChange={(e) => setCostQuad(Number(e.target.value))}
                        style={styles.numberInput}
                    />
                </div>
                <button onClick={handleSaveLoadBalance} style={styles.button}>Set Load Balancing Parameters</button>
                {loadBalanceStatus && (
                    <p style={{ ...styles.status, color: loadBalanceStatus.ok ? "green" : "#c0392b" }}>
                        {loadBalanceStatus.msg}
                    </p>
                )}
            </div>

            {/* Barcode Simulator Ranges */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Barcode Simulator Ranges</h3>
                {simRanges.map((range, i) => (
                    <div key={i} style={styles.simRow}>
                        <label style={styles.label}>Simulator {i + 1}</label>
                        <SimRangeSlider
                            start={range.start}
                            end={range.end}
                            max={maxDestinations}
                            onChange={(field, value) => updateSimRange(i, field, value)}
                        />
                    </div>
                ))}
                <button onClick={handleSaveSimRanges} style={styles.button}>Set Simulator Range</button>
                {simStatus && (
                    <p style={{ ...styles.status, color: simStatus.ok ? "green" : "#c0392b" }}>
                        {simStatus.msg}
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
        fontSize: "15px",
        fontWeight: "600",
        marginBottom: 0,
        marginTop: 0,
        color: "#333",
    },
    sectionSubtitle: {
        fontSize: "12px",
        marginTop: "2px",
        marginBottom: "10px",
        color: "#888",
    },
    row: {
        display: "flex",
        alignItems: "center",
        gap: "16px",
        marginBottom: "12px",
    },
    label: {
        fontSize: "14px",
        color: "#444",
        minWidth: "200px",
    },
    slider: {
        flex: 1,
        accentColor: "#3498db",
        height: "4px",
        cursor: "pointer",
    },
    sliderRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "12px",
    },
    sliderMin: {
        fontSize: "13px",
        color: "#888",
        minWidth: "40px",
    },
    sliderValue: {
        fontSize: "13px",
        fontWeight: "600",
        color: "#3498db",
        minWidth: "50px",
    },
    numberInput: {
        padding: "6px 10px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        width: "100px",
    },
    button: {
        marginTop: "8px",
        padding: "8px 16px",
        fontSize: "14px",
        backgroundColor: "#c0392b",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    status: {
        fontSize: "13px",
        marginTop: "8px",
    },
    simRow: {
        marginBottom: "12px",
    },
    rangeLabel: {
        fontSize: "13px",
        color: "#666",
        minWidth: "30px",
    },
};