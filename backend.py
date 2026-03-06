#!/usr/bin/python3
# 03/05/2026 16:00 MST

import paramiko
import os
import requests
import json
from ruamel.yaml import YAML
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

config_files = ["appcenter", "arq-fipp", "arq-gp", "device-configurator", "device-storage", "qb-api", "qb-barcode-scanner-simulator", "qb-ds", "qb-frontend", "qb-logic", "qb-storage", "qb-tcp-bridge", "system-portal", "task-queue"]
current_path = "/var/lib/appcenter/apps/"

# Module-level state
server = None
sftp = None
password = None
configs = None
simulator_configs = None
floorplan_data = None
floorplan_path = None
sortplan_path = None
barcode_sim_instances = None
max_destinations = 0
max_velocity = 0
ip_list = None
robot_sftp_list = None
sorting_module_configs = {}


# Request models
class ConnectRequest(BaseModel):
    password: str

class RobotPayloadRequest(BaseModel):
    turn_on: bool
    robot_list: list[int]

class SpeedRequest(BaseModel):
    value: float


@app.post("/connect")
def connect(request: ConnectRequest):
    global server, sftp, password
    try:
        print('Attempting connection: 192.168.9.2')
        client = paramiko.SSHClient()
        client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        client.connect('192.168.9.2', username='pvadmin', password=request.password)
        server = client
        sftp = server.open_sftp()
        password = request.password
        print('Connected to Server.')
        return {"status": "connected"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/configs")
def get_configs():
    global configs, simulator_configs, floorplan_data, floorplan_path, sortplan_path, barcode_sim_instances, max_destinations, max_velocity

    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")

    # Load all application configs
    loaded_configs = {}
    for file in config_files:
        yaml = YAML()
        yaml.preserve_quotes = True
        path = current_path + file + "/config.yaml"
        try:
            with sftp.open(path, "r") as yaml_file:
                data = yaml.load(yaml_file)
            loaded_configs[file] = data
        except Exception as e:
            print(f"Could not load config for {file}: {str(e)}")

    if loaded_configs:
        configs = loaded_configs
    else:
        raise HTTPException(status_code=500, detail="No config data found")

    # Count barcode simulator instances
    paths = current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances"
    command = f"find {paths} -maxdepth 1 -type d | wc -l"
    stdin, stdout, stderr = server.exec_command(command)
    count_str = stdout.read().decode('utf-8').strip()
    barcode_sim_instances = int(count_str) - 1

    # Load barcode simulator instance configs
    sim_files = {}
    for i in range(barcode_sim_instances):
        yaml = YAML()
        yaml.preserve_quotes = True
        simulator_path = current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances/" + f"{i+1}" + "/config_" + f"{i+1}" + ".yaml"
        with sftp.open(simulator_path, "r") as file:
            data = yaml.load(file)
        sim_files[i] = data
    simulator_configs = sim_files

    # Load scenario values
    qb_storage = configs["qb-storage"]
    if "path" not in qb_storage["floorplan_file"]:
        floorplan_path = qb_storage["floorplan_file"]
    else:
        floorplan_path = qb_storage["floorplan_file"]["path"]
    if "path" not in qb_storage["sortplan_file"]:
        sortplan_path = qb_storage["sortplan_file"]
    else:
        sortplan_path = qb_storage["sortplan_file"]["path"]

    with open(floorplan_path, 'r') as floorplan_file:
        floorplan_data = json.load(floorplan_file)
        first_value = next(iter(floorplan_data["zones"]))
        max_velocity = float(first_value["constraints"]["max_velocity"])

    max_destinations = 0
    with open(sortplan_path, 'r') as sortplan_file:
        data = json.load(sortplan_file)
        for node in data:
            value = data[node].get("sub_directions")
            if value is None:
                continue
            else:
                bin_number = list(data[node]["sub_directions"].keys())[0]
                if bin_number == 'reject':
                    bin_number = 0
                if int(bin_number) > max_destinations:
                    max_destinations = int(bin_number)

    return {
        "configs": configs,
        "simulator_configs": simulator_configs,
        "barcode_sim_instances": barcode_sim_instances,
        "max_velocity": max_velocity,
        "max_destinations": max_destinations
    }


@app.post("/configs/{application}")
def update_config(application: str, data: dict):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    if configs is None:
        raise HTTPException(status_code=400, detail="Configs not loaded")
    if application not in configs:
        raise HTTPException(status_code=404, detail=f"Application '{application}' not found")

    yaml = YAML()
    yaml.preserve_quotes = True
    configs[application] = data
    path = current_path + application + "/config.yaml"
    try:
        with sftp.open(path, "w") as file:
            yaml.dump(configs[application], file)
        return {"status": "saved", "application": application}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/configs/barcode-sim")
def update_barcode_sim(data: dict):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    if simulator_configs is None:
        raise HTTPException(status_code=400, detail="Simulator configs not loaded")

    yaml = YAML()
    yaml.preserve_quotes = True
    try:
        for i in range(barcode_sim_instances):
            path = current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances/" + f"{i+1}" + "/config_" + f"{i+1}" + ".yaml"
            with sftp.open(path, 'w') as file:
                yaml.dump(simulator_configs[i], file)
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/robots")
def get_active_robots():
    try:
        robots = requests.get('http://192.168.9.2:6019/enabled_robots').json()
        connected_ids = [robot_id for robot_id, data in robots.items() if data.get("connected")]
        robot_ip_list = []
        for connected_id in connected_ids:
            robot_ip_list.append(int(connected_id[2:]))
        print("Found Robots: " + str(robot_ip_list))
        return {"robots": robot_ip_list}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/robots/connect")
def connect_robots():
    global ip_list, robot_sftp_list, sorting_module_configs

    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")

    try:
        robots = requests.get('http://192.168.9.2:6019/enabled_robots').json()
        connected_ids = [robot_id for robot_id, data in robots.items() if data.get("connected")]
        robot_ip_list = [int(connected_id[2:]) for connected_id in connected_ids]
        ip_list = robot_ip_list
    except Exception as e:
        raise HTTPException(status_code=500, detail="Could not fetch robot list: " + str(e))

    robot_sftp_list = {}
    sorting_module_configs = {}
    failed = []

    for number in ip_list:
        robot_client = paramiko.SSHClient()
        robot_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        robot_ip = "192.168.8." + str(number + 30)

        transport = server.get_transport()
        local_addr = ('127.0.0.1', 22)
        dest_addr = (robot_ip, 22)
        try:
            print('Attempting connection: ' + robot_ip)
            channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)
            robot_client.connect('localhost', port=1234, username='pvadmin', password=password, sock=channel, banner_timeout=200)
            robot_sftp = robot_client.open_sftp()
            robot_sftp_list[robot_ip] = robot_sftp

            yaml = YAML()
            yaml.preserve_quotes = True
            path = "/var/lib/appcenter/apps/robot_sorting_module/config.yaml"
            with robot_sftp.open(path, "r") as file:
                data = yaml.load(file)
            sorting_module_configs[robot_ip] = data
        except Exception as e:
            print("Could not connect to robot: " + robot_ip + " — " + str(e))
            failed.append(robot_ip)
            continue

    return {"connected": list(robot_sftp_list.keys()), "failed": failed}


@app.post("/robots/payload-detection")
def payload_detection(request: RobotPayloadRequest):
    if robot_sftp_list is None:
        raise HTTPException(status_code=400, detail="Robots not connected")

    failed = []
    for robot in request.robot_list:
        robot_ip = '192.168.8.' + str(int(robot + 30))
        if robot_ip not in sorting_module_configs:
            failed.append(robot_ip)
            continue
        try:
            data = sorting_module_configs[robot_ip]
            data["payload_detection"] = request.turn_on

            yaml = YAML()
            yaml.preserve_quotes = True
            with robot_sftp_list[robot_ip].open("/var/lib/appcenter/apps/robot-sorting-module/config.yaml", 'w') as file:
                yaml.dump(data, file)
        except Exception as e:
            print("Failed to set payload detection on " + robot_ip + ": " + str(e))
            failed.append(robot_ip)

    return {"status": "done", "failed": failed}


@app.post("/speed")
def update_speed(request: SpeedRequest):
    if floorplan_path is None:
        raise HTTPException(status_code=400, detail="Floorplan not loaded")
    try:
        with open(floorplan_path, 'w') as file:
            data = floorplan_data
            for zone in data["zones"]:
                zone["constraints"]["max_velocity"] = request.value
            json.dump(data, file, indent=2)
        return {"status": "saved", "max_velocity": request.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)