// 04/03/2026 10:00 MST

import { useState, useEffect } from "react";
import { checkServices, checkRobotServices, restartService, restartAllServices, restartAllRobots, connectRobots, restartRobotService } from "../api";

const ROBOT_APPS = [
    "robot-manager",
    "robot-diagnostics",
    "robot-sorting-module",
    "robot-diagnostics-bridge",
];

export default function ServerApps({ serverApps, connectedRobots, setConnectedRobots, payloadState, setPayloadState }) {
    const [serviceStatus, setServiceStatus] = useState({});
    const [robotServiceStatus, setRobotServiceStatus] = useState({});
    const [statusMsg, setStatusMsg] = useState(null);
    const [restartingAll, setRestartingAll] = useState(false);
    const [restarting, setRestarting] = useState({});
    const [selectedRobot, setSelectedRobot] = useState(null);
    const [connectingRobots, setConnectingRobots] = useState(false);
    const [fetchingRobotStatus, setFetchingRobotStatus] = useState(false);

    useEffect(() => {
        fetchServiceStatus();
    }, []);

    async function fetchServiceStatus() {
        try {
            const data = await checkServices();
            setServiceStatus(data);
        } catch (e) {
            setStatusMsg({ ok: false, msg: "Could not fetch service status: " + e.message });
        }
    }

    async function fetchRobotServiceStatus(robotNumber) {
        setFetchingRobotStatus(true);
        try {
            const data = await checkRobotServices(robotNumber);
            setRobotServiceStatus(data);
        } catch (e) {
            setStatusMsg({ ok: false, msg: "Could not fetch robot service status: " + e.message });
        } finally {
            setFetchingRobotStatus(false);
        }
    }

    async function handleSelectRobot(value) {
        const robotId = value === "" ? null : parseInt(value);
        setSelectedRobot(robotId);
        setRobotServiceStatus({});
        if (robotId !== null) {
            await fetchRobotServiceStatus(robotId);
        }
    }

    async function handleRestartService(service) {
        setRestarting((prev) => ({ ...prev, [service]: true }));
        setStatusMsg(null);
        try {
            await restartService(service);
            setStatusMsg({ ok: true, msg: `${service} restarted successfully.` });
            await fetchServiceStatus();
        } catch (e) {
            setStatusMsg({ ok: false, msg: `Failed to restart ${service}: ` + e.message });
        } finally {
            setRestarting((prev) => ({ ...prev, [service]: false }));
        }
    }

    async function handleRestartAllServer() {
        setRestartingAll(true);
        setStatusMsg(null);
        try {
            await restartAllServices("server");
            setStatusMsg({ ok: true, msg: "All server services restarted successfully." });
            await fetchServiceStatus();
        } catch (e) {
            setStatusMsg({ ok: false, msg: "Failed to restart all server services: " + e.message });
        } finally {
            setRestartingAll(false);
        }
    }

    async function handleRestartRobotService(service) {
        if (selectedRobot === null) return;
        setRestarting((prev) => ({ ...prev, [service]: true }));
        setStatusMsg(null);
        try {
            await restartRobotService(selectedRobot, service);
            setStatusMsg({ ok: true, msg: `${service} restarted on robot ${selectedRobot}.` });
            await fetchRobotServiceStatus(selectedRobot);
        } catch (e) {
            setStatusMsg({ ok: false, msg: `Failed to restart ${service} on robot ${selectedRobot}: ` + e.message });
        } finally {
            setRestarting((prev) => ({ ...prev, [service]: false }));
        }
    }

    async function handleRestartAllRobots() {
        if (selectedRobot === null) return;
        setRestartingAll(true);
        setStatusMsg(null);
        try {
            await restartAllRobots(selectedRobot);
            setStatusMsg({ ok: true, msg: `All robot services restarted on robot ${selectedRobot}.` });
            await fetchRobotServiceStatus(selectedRobot);
        } catch (e) {
            setStatusMsg({ ok: false, msg: `Failed to restart robot services: ` + e.message });
        } finally {
            setRestartingAll(false);
        }
    }

    async function handleConnectRobots() {
        setConnectingRobots(true);
        setStatusMsg(null);
        try {
            const data = await connectRobots();
            setConnectedRobots(data.connected);
            setSelectedRobot(null);
            setRobotServiceStatus({});

            // Initialize shared payload state from connect response
            const initialPayloadState = {};
            if (data.payload_states) {
                for (const [ip, state] of Object.entries(data.payload_states)) {
                    const id = parseInt(ip.split(".")[3]) - 30;
                    initialPayloadState[id] = state;
                }
            }
            setPayloadState(initialPayloadState);
        } catch (e) {
            setStatusMsg({ ok: false, msg: "Could not connect to robots: " + e.message });
        } finally {
            setConnectingRobots(false);
        }
    }

    function extractRobotId(ip) {
        return parseInt(ip.split(".")[3]) - 30;
    }

    function ServiceRow({ service }) {
        const active = serviceStatus && serviceStatus[service] === 1;
        return (
            <div style={styles.serviceRow}>
                <div style={styles.serviceLeft}>
                    <span style={{ ...styles.dot, backgroundColor: active ? "#2ecc71" : "#bbb" }} />
                    <span style={styles.serviceName}>{service}</span>
                </div>
                <button
                    onClick={() => handleRestartService(service)}
                    disabled={restarting[service]}
                    style={styles.restartBtn}
                    title="Restart"
                >
                    {restarting[service] ? "..." : "↻"}
                </button>
            </div>
        );
    }

    function RobotServiceRow({ service }) {
        const active = robotServiceStatus && robotServiceStatus[service] === 1;
        const disabled = restarting[service] || selectedRobot === null;
        const dotColor = selectedRobot === null
            ? "#bbb"
            : fetchingRobotStatus
                ? "#f0ad4e"
                : active ? "#2ecc71" : "#bbb";
        return (
            <div style={styles.serviceRow}>
                <div style={styles.serviceLeft}>
                    <span style={{ ...styles.dot, backgroundColor: dotColor }} />
                    <span style={styles.serviceName}>{service}</span>
                </div>
                <button
                    onClick={() => handleRestartRobotService(service)}
                    disabled={disabled}
                    style={{ ...styles.restartBtn, ...(disabled ? { color: "#ccc" } : {}) }}
                    title={selectedRobot === null ? "Select a robot first" : "Restart"}
                >
                    {restarting[service] ? "..." : "↻"}
                </button>
            </div>
        );
    }

    return (
        <div style={styles.wrapper}>
            {statusMsg && (
                <p style={{ ...styles.status, color: statusMsg.ok ? "green" : "#c0392b" }}>
                    {statusMsg.msg}
                </p>
            )}

            {/* Server Apps */}
            <div style={styles.sectionLabel}>SERVER APPS</div>
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <div>
                        <div style={styles.cardTitle}>Server Applications</div>
                        <div style={styles.cardSubtitle}>Core server-side services running on the FRS controller.</div>
                    </div>
                    <button
                        onClick={handleRestartAllServer}
                        disabled={restartingAll}
                        style={styles.restartAllBtn}
                    >
                        ↻ {restartingAll ? "Restarting..." : "Restart All"}
                    </button>
                </div>
                {serverApps.map((service) => (
                    <ServiceRow key={service} service={service} />
                ))}
            </div>

            {/* Robot Apps */}
            <div style={{ ...styles.sectionLabel, marginTop: "32px" }}>ROBOT APPS</div>
            <div style={styles.card}>
                <div style={styles.cardHeader}>
                    <div>
                        <div style={styles.cardTitle}>Robot Applications</div>
                        <div style={styles.cardSubtitle}>Services deployed to and running on robots.</div>
                    </div>
                    <button
                        onClick={handleRestartAllRobots}
                        disabled={restartingAll || selectedRobot === null}
                        style={{
                            ...styles.restartAllBtn,
                            ...(selectedRobot === null ? styles.restartAllBtnDisabled : {}),
                        }}
                    >
                        ↻ {restartingAll ? "Restarting..." : "Restart All"}
                    </button>
                </div>
                <div style={styles.robotConnectRow}>
                    <button
                        onClick={handleConnectRobots}
                        disabled={connectingRobots}
                        style={styles.connectBtn}
                    >
                        {connectingRobots ? "Connecting..." : "Connect to Robots"}
                    </button>
                    {connectedRobots.length > 0 && (
                        <select
                            value={selectedRobot ?? ""}
                            onChange={(e) => handleSelectRobot(e.target.value)}
                            style={styles.select}
                        >
                            <option value="">Select a robot</option>
                            {connectedRobots.map((ip) => {
                                const id = extractRobotId(ip);
                                return (
                                    <option key={ip} value={id}>Robot {id} ({ip})</option>
                                );
                            })}
                        </select>
                    )}
                    {connectedRobots.length === 0 && !connectingRobots && (
                        <span style={styles.dimText}>No robots connected.</span>
                    )}
                    {fetchingRobotStatus && (
                        <span style={styles.dimText}>Fetching status...</span>
                    )}
                </div>
                {ROBOT_APPS.map((service) => (
                    <RobotServiceRow key={service} service={service} />
                ))}
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
    sectionLabel: {
        fontSize: "11px",
        fontWeight: "700",
        color: "#888",
        letterSpacing: "1px",
        marginBottom: "8px",
    },
    card: {
        backgroundColor: "#fff",
        borderRadius: "8px",
        boxShadow: "0 1px 6px rgba(0,0,0,0.08)",
        overflow: "hidden",
    },
    cardHeader: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "16px 20px",
        borderBottom: "1px solid #f0f0f0",
    },
    cardTitle: {
        fontSize: "15px",
        fontWeight: "600",
        color: "#222",
    },
    cardSubtitle: {
        fontSize: "12px",
        color: "#888",
        marginTop: "2px",
    },
    restartAllBtn: {
        padding: "8px 14px",
        fontSize: "13px",
        backgroundColor: "#e67e22",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "600",
    },
    serviceRow: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 20px",
        borderBottom: "1px solid #f5f5f5",
    },
    serviceLeft: {
        display: "flex",
        alignItems: "center",
        gap: "10px",
    },
    dot: {
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        display: "inline-block",
    },
    serviceName: {
        fontSize: "14px",
        color: "#333",
    },
    restartBtn: {
        background: "none",
        border: "none",
        fontSize: "18px",
        color: "#3498db",
        cursor: "pointer",
        padding: "4px 8px",
    },
    status: {
        fontSize: "13px",
        marginBottom: "16px",
    },
    robotConnectRow: {
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 20px",
        borderBottom: "1px solid #f0f0f0",
    },
    connectBtn: {
        padding: "7px 14px",
        fontSize: "13px",
        backgroundColor: "#3498db",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    select: {
        padding: "7px 10px",
        fontSize: "13px",
        border: "1px solid #ccc",
        borderRadius: "4px",
        cursor: "pointer",
    },
    dimText: {
        fontSize: "13px",
        color: "#999",
    },
    restartAllBtnDisabled: {
        backgroundColor: "#ccc",
        cursor: "not-allowed",
    },
};