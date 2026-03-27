// 03/20/2026 10:00 MST

import { useState, useEffect, useRef } from "react";
import { connectToServer, getConfigs } from "./api";
import ServerApps from "./tabs/ServerApps";
import ServerConfigs from "./tabs/ServerConfigs";
import RobotConfigs from "./tabs/RobotConfigs";

export default function App() {
    const [connected, setConnected] = useState(false);
    const [password, setPassword] = useState("");
    const [activeTab, setActiveTab] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [configs, setConfigs] = useState(null);
    const [simulatorConfigs, setSimulatorConfigs] = useState(null);
    const [barcodeSimInstances, setBarcodeSimInstances] = useState(0);
    const [maxVelocity, setMaxVelocity] = useState(1.0);
    const [maxDestinations, setMaxDestinations] = useState(0);
    const [serverApps, setServerApps] = useState([]);
    const [floorplans, setFloorplans] = useState([]);
    const [sortplans, setSortplans] = useState([]);
    const [currentFloorplan, setCurrentFloorplan] = useState("");
    const [currentSortplan, setCurrentSortplan] = useState("");

    // Tracks whether any tab has undo history — used for beforeunload warning
    const tabHistoriesRef = useRef({ serverConfigs: false, robotConfigs: false });

    function handleHistoryChange(tab, hasHistory) {
        tabHistoriesRef.current[tab] = hasHistory;
    }

    useEffect(() => {
        function handleBeforeUnload(e) {
            if (Object.values(tabHistoriesRef.current).some(Boolean)) {
                e.preventDefault();
                e.returnValue = '';
            }
        }
        if (connected) {
            window.addEventListener('beforeunload', handleBeforeUnload);
            return () => window.removeEventListener('beforeunload', handleBeforeUnload);
        }
    }, [connected]);

    async function handleConnect() {
        setLoading(true);
        setError(null);
        try {
            await connectToServer(password);
            const data = await getConfigs();
            setConfigs(data.configs);
            setSimulatorConfigs(data.simulator_configs);
            setBarcodeSimInstances(data.barcode_sim_instances);
            setMaxVelocity(data.max_velocity);
            setMaxDestinations(data.max_destinations);
            setServerApps(data.server_apps);
            setFloorplans(data.floorplans);
            setSortplans(data.sortplans);
            setCurrentFloorplan(data.current_floorplan);
            setCurrentSortplan(data.current_sortplan);
            setConnected(true);
        } catch (e) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }

    const tabs = ["Server and Robot Applications", "Server Configs", "Robot Configs"];

    if (!connected) {
        return (
            <div style={styles.centerWrapper}>
                <div style={styles.connectBox}>
                    <h1 style={styles.title}>Prime Vision Technology</h1>
                    <h2 style={styles.subtitle}>Settings / Configuration UI</h2>
                    <input
                        type="password"
                        placeholder="Enter Server Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                        style={styles.input}
                    />
                    <button
                        onClick={handleConnect}
                        disabled={loading}
                        style={styles.button}
                    >
                        {loading ? "Connecting..." : "Connect to Server"}
                    </button>
                    {error && <p style={styles.error}>{error}</p>}
                </div>
            </div>
        );
    }

    return (
        <div style={styles.appWrapper}>
            <h1 style={styles.appTitle}>Prime Vision Technology Settings / Configuration UI</h1>
            <div style={styles.tabBar}>
                {tabs.map((tab, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveTab(i)}
                        style={{
                            ...styles.tabButton,
                            ...(activeTab === i ? styles.tabButtonActive : {}),
                        }}
                    >
                        {tab}
                    </button>
                ))}
            </div>
            <div style={styles.tabContent}>
                {activeTab === 0 && <ServerApps serverApps={serverApps} />}
                {activeTab === 1 && (
                    <ServerConfigs
                        configs={configs}
                        setConfigs={setConfigs}
                        simulatorConfigs={simulatorConfigs}
                        setSimulatorConfigs={setSimulatorConfigs}
                        barcodeSimInstances={barcodeSimInstances}
                        maxDestinations={maxDestinations}
                        floorplans={floorplans}
                        sortplans={sortplans}
                        currentFloorplan={currentFloorplan}
                        currentSortplan={currentSortplan}
                        onHistoryChange={(has) => handleHistoryChange("serverConfigs", has)}
                    />
                )}
                {activeTab === 2 && (
                    <RobotConfigs
                        maxVelocity={maxVelocity}
                        onHistoryChange={(has) => handleHistoryChange("robotConfigs", has)}
                    />
                )}
            </div>
        </div>
    );
}

const styles = {
    centerWrapper: {
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        backgroundColor: "#f0f2f5",
    },
    connectBox: {
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        padding: "40px",
        backgroundColor: "#fff",
        borderRadius: "8px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.1)",
        minWidth: "320px",
    },
    title: {
        margin: 0,
        fontSize: "22px",
        fontWeight: "700",
        color: "#c0392b",
    },
    subtitle: {
        margin: 0,
        fontSize: "15px",
        fontWeight: "400",
        color: "#555",
    },
    input: {
        padding: "10px",
        fontSize: "14px",
        border: "1px solid #ccc",
        borderRadius: "4px",
    },
    button: {
        padding: "10px",
        fontSize: "14px",
        backgroundColor: "#c0392b",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
    },
    error: {
        color: "#c0392b",
        fontSize: "13px",
        margin: 0,
    },
    appWrapper: {
        padding: "24px",
        fontFamily: "sans-serif",
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        width: "100vw",
        boxSizing: "border-box",
    },
    appTitle: {
        fontSize: "20px",
        fontWeight: "700",
        color: "#c0392b",
        marginBottom: "16px",
    },
    tabBar: {
        display: "flex",
        gap: "8px",
        borderBottom: "2px solid #c0392b",
        marginBottom: "24px",
    },
    tabButton: {
        padding: "8px 16px",
        fontSize: "14px",
        border: "none",
        backgroundColor: "transparent",
        cursor: "pointer",
        color: "#555",
        borderBottom: "2px solid transparent",
        marginBottom: "-2px",
    },
    tabButtonActive: {
        color: "#c0392b",
        fontWeight: "600",
        borderBottom: "2px solid #c0392b",
    },
    tabContent: {
        padding: "8px 0",
        flex: 1,
        display: "flex",
        justifyContent: "center",
    },
};