import { useState } from "react";
import { connectRobots, setPayloadDetection, updateSpeed } from "../api";

export default function RobotConfigs({ maxVelocity }) {
    const [connectedRobots, setConnectedRobots] = useState([]);
    const [failedRobots, setFailedRobots] = useState([]);
    const [selectedRobots, setSelectedRobots] = useState([]);
    const [selectAll, setSelectAll] = useState(false);
    const [speed, setSpeed] = useState(maxVelocity ?? 1.0);

    const [connectStatus, setConnectStatus] = useState(null);
    const [payloadStatus, setPayloadStatus] = useState(null);
    const [speedStatus, setSpeedStatus] = useState(null);
    const [connectLoading, setConnectLoading] = useState(false);

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
            setPayloadStatus({ ok: true, msg: `Payload detection turned ${turnOn ? "on" : "off"}.` });
        } catch (e) {
            setPayloadStatus({ ok: false, msg: e.message });
        }
    }

    async function handleSaveSpeed() {
        setSpeedStatus(null);
        try {
            await updateSpeed(speed);
            setSpeedStatus({ ok: true, msg: "Saved." });
        } catch (e) {
            setSpeedStatus({ ok: false, msg: e.message });
        }
    }

    return (
        <div style={styles.wrapper}>
            <h2 style={styles.header}>Robot Configurations</h2>

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
                                    <label htmlFor={`robot-${id}`} style={styles.checkLabel}>Robot {id} ({ip})</label>
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
    },
    dimText: {
        fontSize: "14px",
        color: "#999",
    },
};