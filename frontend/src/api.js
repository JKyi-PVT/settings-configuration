const BASE_URL = "";

async function handleResponse(res) {
    const data = await res.json();
    if (!res.ok) {
        throw new Error(data.detail || "An unknown error occurred");
    }
    return data;
}

export async function connectToServer(password) {
    const res = await fetch(`${BASE_URL}/connect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
    });
    return handleResponse(res);
}

export async function getScenarioFiles(type) {
    const res = await fetch(`${BASE_URL}/scenario/${type}`);
    return handleResponse(res);
}

export async function getConfigs() {
    const res = await fetch(`${BASE_URL}/configs`);
    return handleResponse(res);
}

export async function updateConfig(application, config, data) {
    const res = await fetch(`${BASE_URL}/configs/${application}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ setting_name: config, value: data }),
    });
    return handleResponse(res);
}

export async function updateBarcodeSim(instance, rangeStart, rangeEnd) {
    const res = await fetch(`${BASE_URL}/configs/qb-barcode-scanner-simulator/${instance}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ range_start: rangeStart, range_end: rangeEnd }),
    });
    return handleResponse(res);
}

export async function getActiveRobots() {
    const res = await fetch(`${BASE_URL}/robots`);
    return handleResponse(res);
}

export async function connectRobots() {
    const res = await fetch(`${BASE_URL}/robots/connect`, {
        method: "POST",
    });
    return handleResponse(res);
}

export async function setPayloadDetection(turnOn, robotList) {
    const res = await fetch(`${BASE_URL}/robots/payload-detection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turn_on: turnOn, robot_list: robotList }),
    });
    return handleResponse(res);
}

export async function updateSpeed(value) {
    const res = await fetch(`${BASE_URL}/speed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value }),
    });
    return handleResponse(res);
}

export async function checkServices() {
    const res = await fetch(`${BASE_URL}/server/configs/service`);
    return handleResponse(res);
}

export async function restartService(service, target = "server") {
    const res = await fetch(`${BASE_URL}/restart/${service}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
    });
    return handleResponse(res);
}

export async function restartAllServices(target) {
    const res = await fetch(`${BASE_URL}/restart-all`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
    });
    return handleResponse(res);
}

export async function restartAllRobots(robotNumber) {
    const res = await fetch(`${BASE_URL}/restart-all/robots/${robotNumber}`, {
        method: "POST",
    });
    return handleResponse(res);
}

export async function restartRobotService(robotNumber, service) {
    const res = await fetch(`${BASE_URL}/restart-robot/${robotNumber}/${service}`, {
        method: "POST",
    });
    return handleResponse(res);
}