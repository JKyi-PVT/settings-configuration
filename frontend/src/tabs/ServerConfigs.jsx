import { useState, useEffect } from "react";
import { updateConfig, updateBarcodeSim } from "../api";

export default function ServerConfigs({ configs, setConfigs, simulatorConfigs, setSimulatorConfigs, barcodeSimInstances, maxDestinations }) {
    const [timeout, setTimeout] = useState(configs?.["qb-ds"]?.["input_cell_deactivation_timeout"] ?? 30);
    const [costLinear, setCostLinear] = useState(configs?.["arq-gp"]?.["target_reservation_cost_linear"] ?? 0);
    const [costQuad, setCostQuad] = useState(configs?.["arq-gp"]?.["target_reservation_cost_quad"] ?? 0);
    const [simRanges, setSimRanges] = useState([]);

    const [timeoutStatus, setTimeoutStatus] = useState(null);
    const [loadBalanceStatus, setLoadBalanceStatus] = useState(null);
    const [simStatus, setSimStatus] = useState(null);

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

    async function handleSaveTimeout() {
        setTimeoutStatus(null);
        try {
            const updated = { ...configs["qb-ds"], input_cell_deactivation_timeout: timeout };
            await updateConfig("qb-ds", updated);
            setConfigs((prev) => ({ ...prev, "qb-ds": updated }));
            setTimeoutStatus({ ok: true, msg: "Saved." });
        } catch (e) {
            setTimeoutStatus({ ok: false, msg: e.message });
        }
    }

    async function handleSaveLoadBalance() {
        setLoadBalanceStatus(null);
        try {
            const updated = {
                ...configs["arq-gp"],
                target_reservation_cost_linear: costLinear,
                target_reservation_cost_quad: costQuad,
            };
            await updateConfig("arq-gp", updated);
            setConfigs((prev) => ({ ...prev, "arq-gp": updated }));
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

    return (
        <div style={styles.wrapper}>
            <h2 style={styles.header}>Server Configurations</h2>

            {/* Infeed Timeout */}
            <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Infeed Timeout</h3>
                <div style={styles.sectionSubtitle}>Time before an infeed stations times out waiting for a package</div>
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
                        <div style={styles.rangeInputs}>
                            <div style={styles.rangeField}>
                                <span style={styles.rangeLabel}>Start</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={maxDestinations}
                                    value={range.start}
                                    onChange={(e) => updateSimRange(i, "start", e.target.value)}
                                    style={styles.numberInput}
                                />
                            </div>
                            <div style={styles.rangeField}>
                                <span style={styles.rangeLabel}>End</span>
                                <input
                                    type="number"
                                    min={0}
                                    max={maxDestinations}
                                    value={range.end}
                                    onChange={(e) => updateSimRange(i, "end", e.target.value)}
                                    style={styles.numberInput}
                                />
                            </div>
                        </div>
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
    header: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#c0392b",
        borderBottom: "2px solid #c0392b",
        paddingBottom: "8px",
        marginBottom: "24px",
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
    rangeInputs: {
        display: "flex",
        gap: "24px",
        marginTop: "6px",
    },
    rangeField: {
        display: "flex",
        alignItems: "center",
        gap: "8px",
    },
    rangeLabel: {
        fontSize: "13px",
        color: "#666",
        minWidth: "30px",
    },
};