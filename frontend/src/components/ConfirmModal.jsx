// 03/20/2026 10:00 MST

export default function ConfirmModal({ changes, onConfirm, onCancel }) {
    if (!changes) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h3 style={styles.title}>Confirm Undo</h3>
                <p style={styles.subtitle}>The following changes will be reverted:</p>
                <div style={styles.tableWrapper}>
                    <table style={styles.table}>
                        <thead>
                            <tr>
                                <th style={styles.th}>Setting</th>
                                <th style={styles.th}>Current Value</th>
                                <th style={styles.th}>Will Revert To</th>
                            </tr>
                        </thead>
                        <tbody>
                            {changes.map(({ label, from, to }, i) => (
                                <tr key={i} style={i % 2 === 0 ? styles.rowEven : styles.rowOdd}>
                                    <td style={styles.td}>{label}</td>
                                    <td style={{ ...styles.td, ...styles.fromVal }}>{from}</td>
                                    <td style={{ ...styles.td, ...styles.toVal }}>{to}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={styles.buttonRow}>
                    <button onClick={onCancel} style={styles.cancelBtn}>Cancel</button>
                    <button onClick={onConfirm} style={styles.confirmBtn}>Confirm Undo</button>
                </div>
            </div>
        </div>
    );
}

const styles = {
    overlay: {
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
    },
    modal: {
        backgroundColor: "#fff",
        borderRadius: "8px",
        padding: "28px",
        width: "520px",
        maxWidth: "90vw",
        boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
    },
    title: {
        margin: "0 0 6px 0",
        fontSize: "17px",
        fontWeight: "700",
        color: "#222",
    },
    subtitle: {
        margin: "0 0 16px 0",
        fontSize: "13px",
        color: "#666",
    },
    tableWrapper: {
        overflowX: "auto",
        marginBottom: "20px",
        borderRadius: "4px",
        border: "1px solid #e0e0e0",
    },
    table: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: "13px",
    },
    th: {
        textAlign: "left",
        padding: "10px 14px",
        backgroundColor: "#f5f5f5",
        fontWeight: "600",
        color: "#444",
        borderBottom: "1px solid #e0e0e0",
    },
    td: {
        padding: "10px 14px",
        color: "#333",
    },
    rowEven: {
        backgroundColor: "#fff",
    },
    rowOdd: {
        backgroundColor: "#fafafa",
    },
    fromVal: {
        color: "#c0392b",
        fontWeight: "500",
    },
    toVal: {
        color: "#27ae60",
        fontWeight: "500",
    },
    buttonRow: {
        display: "flex",
        justifyContent: "flex-end",
        gap: "10px",
    },
    cancelBtn: {
        padding: "8px 18px",
        fontSize: "14px",
        backgroundColor: "#fff",
        color: "#555",
        border: "1px solid #ccc",
        borderRadius: "4px",
        cursor: "pointer",
    },
    confirmBtn: {
        padding: "8px 18px",
        fontSize: "14px",
        backgroundColor: "#c0392b",
        color: "#fff",
        border: "none",
        borderRadius: "4px",
        cursor: "pointer",
        fontWeight: "600",
    },
};