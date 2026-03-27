#!/usr/bin/python3
# 03/05/2026 16:00 MST

from operator import is_

import paramiko
import time
import os
import sys
import requests
import json
import webbrowser
import subprocess
from ruamel.yaml import YAML
from typing import Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
robot_configs = ["robot-manager", "robot-diagnostics", "robot-diagnostics-bridge", "robot-sorting-module"]
current_path = "/var/lib/appcenter/apps/"

# Module-level state
server = None
sftp = None
password = None
configs = None
server_apps = None
simulator_configs = None
floorplan_data = None
floorplan_path = None
sortplan_path = None
barcode_sim_instances = None
max_destinations = 0
max_velocity = 0
ip_list = None
robot_sftp_list = None
floorplan_list = {}
sortplan_list = {}
sorting_module_configs = {}
frs_version = '7.1.0'


# Request models
class ConnectRequest(BaseModel):
    password: str

class RobotPayloadRequest(BaseModel):
    turn_on: bool
    robot_list: list[int]

class ServerConfigChangeRequest(BaseModel):
    setting_name: str
    value: Any

class UpdateBarcodeSimRequest(BaseModel):
    range_start: Any
    range_end: Any

class SpeedRequest(BaseModel):
    value: float

class RestartRequest(BaseModel):
    target: str

class RestartAllRequest(BaseModel):
    target: str



def get_server_apps():
    global server_apps

    names = []
    if server is None:
        raise HTTPException(status_code = 400, detail="Not connected to server")
    else:
        cmd = "systemctl list-units --type=service --state=running | grep cx_"
        _, ssh_stdout, ssh_stderr = server.exec_command(cmd)
        all_raw_services = ssh_stdout.readlines()
        
        for service in all_raw_services:
            
            service = service.strip().split(" ")[0]
            substring = get_substring(service)
            names.append(substring)
        cmd = "systemctl list-unit-files --type=service --state=disabled  | grep cx"
        _, ssh_stdout, ssh_stderr = server.exec_command(cmd)
        all_disabled_services = ssh_stdout.readlines()

        for service in all_disabled_services:
            service = service.strip().split(" ")[0]
            substring = get_substring(service)
            if substring in names:
                continue
            else:
                names.append(substring)
        
        server_apps = names

def is_server_connected():
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")

@app.get("/emergency/create_backup")
def create_backup():
    is_server_connected()
    cmd = "cp -r /var/lib/appcenter /var/lib/backup_appcenter"
    server.exec_command(cmd)

@app.get("/emergency/load_backup")
def load_backup():
    is_server_connected()
    server.exec_command("rsync -avn --delete /var/lib/backup_appcenter/ /var/lib/appcenter/")
    create_backup()

def get_scenario_files(type):
    global floorplan_list, sortplan_list
    is_server_connected()
    cmd = f"find /home/pvadmin/envs/cx-local/designs/{type} -type f -name '*.json'"
    _, ssh_stdout, ssh_stderr = server.exec_command(cmd)
    test_output = ssh_stdout.read().decode('utf-8').strip()
    print(test_output)
    files = test_output.split("\n")
    raw_output = ssh_stdout.readlines()
    list = []

    for file_path in files:
        file_name = file_path.split("/")[-1]
        if type == "floorplans":
            floorplan_list[file_name] = file_path
        elif type == "sortplans":
             sortplan_list[file_name] = file_path
        list.append(file_path)

    print(list)
    return list

@app.post("/connect")
def connect(request: ConnectRequest):
    global server, sftp, password
    print('Connected to Server')
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

    get_server_apps()

    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")

    # Load all application configs
    loaded_configs = {}
    for file in server_apps:
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
    set_frs_version()
    paths = current_path + "qb-barcode-scanner-simulator/" + frs_version + "-22-04/instances"
    command = f"find {paths} -maxdepth 1 -type d | wc -l"
    stdin, stdout, stderr = server.exec_command(command)
    count_str = stdout.read().decode('utf-8').strip()
    barcode_sim_instances = int(count_str) - 1

    # Load barcode simulator instance configs
    sim_files = {}
    for i in range(barcode_sim_instances):
        yaml = YAML()
        yaml.preserve_quotes = True
        simulator_path = paths + "/" + f"{i+1}" + "/config_" + f"{i+1}" + ".yaml"
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

    with sftp.open(floorplan_path, 'r') as floorplan_file:
        floorplan_data = json.load(floorplan_file)
        first_value = next(iter(floorplan_data["zones"]))
        max_velocity = float(first_value["constraints"]["max_velocity"])

    with sftp.open(sortplan_path, 'r') as sortplan_file:
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
    
    floorplan_list = get_scenario_files("floorplans")
    sortplan_list = get_scenario_files("sortplans")
    current_sortplan = sortplan_path.split("/")[-1]
    current_floorplan = floorplan_path.split("/")[-1]

    return {
        "configs": configs,
        "simulator_configs": simulator_configs,
        "barcode_sim_instances": barcode_sim_instances,
        "max_velocity": max_velocity,
        "max_destinations": max_destinations,
        "server_apps": server_apps,
        "floorplans": floorplan_list, 
        "sortplans": sortplan_list,
        "current_floorplan": current_floorplan,
        "current_sortplan": current_sortplan     
    }



@app.post("/configs/{application}")
def update_config(application: str, request: ServerConfigChangeRequest):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    if configs is None:
        raise HTTPException(status_code=400, detail="Configs not loaded")
    if application not in configs:
        raise HTTPException(status_code=404, detail=f"Application '{application}' not found")

    yaml = YAML()
    yaml.preserve_quotes = True
    print(configs[application][request.setting_name])
    configs[application][request.setting_name] = request.value
    path = current_path + application + "/config.yaml"
    try:
        with sftp.open(path, "w") as file:
            yaml.dump(configs[application], file)
        return {"status": "saved", "application": application}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
def get_substring(string):
    substring = string.split('_')[1]
    return substring

def set_frs_version():
    global frs_version
    cmd = "systemctl list-units --type=service --state=running | grep cx_qb-ds"
    _, ssh_stdout, ssh_stderr = server.exec_command(cmd)
    raw_readout = ssh_stdout.readlines()

    service = raw_readout[0].split(" ")[2]
    frs_version = service.split('_')[2][:5]
    
@app.get("/server/configs/service")
def check_service_active():
    if server is None:
        raise HTTPException(status_code = 400, detail="Not connected to server")
    else:
        all_services = dict.fromkeys(server_apps, 0)
        cmd = "systemctl list-units --type=service --state=running | grep cx_"
        _, ssh_stdout, ssh_stderr = server.exec_command(cmd)
        all_raw_services = ssh_stdout.readlines()
        
        for service in all_raw_services:
            
            service = service.strip().split(" ")[0]
            substring = get_substring(service)
            all_services[substring] = 1

        return all_services
    
@app.post("/restart/{service}")
def restart_service(service: str, request: RestartRequest, client=None):
    if request.target == "server":
        client = server
    if client is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    else:
        key = "cx_" + service
        cmd = f"systemctl list-units --type=service | grep {key}"
        attempts = 0
        success = False
        while success is False and attempts < 3:
            try:
                _, ssh_stdout, ssh_stderr = client.exec_command(cmd)
                line = ssh_stdout.read().decode().strip().split(" ")[0]
                ssh_stdin, ssh_stdout, ssh_stderr = client.exec_command("sudo -S -p '' systemctl restart " + line)
                ssh_stdin.write(password + "\n")
                ssh_stdin.flush()
                success = True
                print("Successfully Restarted Service: " + service)
            except Exception as e:
                print(str(e))
                time.sleep(1)
                attempts = attempts + 1
        return {"status": "done", "service": service}



@app.post("/restart-all")
def restart_all_services(request: RestartAllRequest, client=None):
    if request.target == "server":
        client = server
    if client is None:
        raise HTTPException(status_code=400, detail="Not connected to target client")
    else:
        new_cmd = "systemctl list-units --type=service --state=running | grep cx_"
        _, ssh_stdout, ssh_stderr = client.exec_command(new_cmd)
        all_raw_services = ssh_stdout.readlines()
        all_services = []

        for service in all_raw_services:
            print("Found Service: " + service)
            service = service.strip().split(" ")[0]
            if "appcenter" not in service:
                all_services.append(service)
        for service in all_services:
            result = False
            Attempts = 0
            while result is False and Attempts < 3:
                try:
                    print(service)
                    print("Restarting Service: " + service)
                    ssh_stdin, ssh_stdout, ssh_stderr = client.exec_command("sudo -S -p '' systemctl restart " + service)
                    # error = ssh_stderr.readlines()
                    # print(error)
                    ssh_stdin.write(password + "\n")
                    ssh_stdin.flush()
                    result = True
                    print("Successfully Restarted Service: " + service)
                except Exception as e:
                    print(str(e))
                    print("Failed to Restart Service, Trying Again: " + service)
                    time.sleep(1)
                    Attempts = Attempts + 1 

@app.get("robots/service/{robot_number}")
def check_robot_services(robot_number: int):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    else:
        cmd = "systemctl list-units --type=service --state=running | grep cx_"
        robot_client = paramiko.SSHClient()
        robot_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        transport = server.get_transport()
        local_addr = ('127.0.0.1', 22)
        robot_ip = "192.168.8." + str(robot_number + 30)
        dest_addr = (robot_ip, 22)
        all_services = dict.fromkeys(robot_configs, 0)
        try:
            channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)
            robot_client.connect('localhost', port=1234, username='pvadmin', password=password, sock=channel, banner_timeout=200)
            _, ssh_stdout, ssh_stderr = robot_client.exec_command(cmd)
            all_raw_services = ssh_stdout.readlines()
            for service in all_raw_services:

                service = service.strip().split(" ")[0]
                substring = get_substring(service)
                all_services[substring] = 1

        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        return all_services
    
@app.post("restart-robot/{robot_number}/{service}")
def restart_robot_service(robot_number: int, service: str):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    else:
        robot_client = paramiko.SSHClient()
        robot_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        transport = server.get_transport()
        local_addr = ('127.0.0.1', 22)
        robot_ip = "192.168.8." + str(robot_number + 30)
        dest_addr = (robot_ip, 22)
        try:
            channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)
            robot_client.connect('localhost', port=1234, username='pvadmin', password=password, sock=channel, banner_timeout=200)
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        restart_service(service, RestartAllRequest(target="robot"), client=robot_client)
        return {"status": "done", "robot": robot_ip, "service": service}
    

@app.post("restart-all/robots/{robot_number}")
def restart_robot_services(robot_number: int):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    else:
        robot_client = paramiko.SSHClient()
        robot_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        transport = server.get_transport()
        local_addr = ('127.0.0.1', 22)
        robot_ip = "192.168.8." + str(robot_number + 30)
        dest_addr = (robot_ip, 22)
        try:
            channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)
            robot_client.connect('localhost', port=1234, username='pvadmin', password=password, sock=channel, banner_timeout=200)            
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))
        restart_all_services(RestartAllRequest(target="robot"), client=robot_client)
        return {"status": "done", "robot": robot_ip}


@app.post("/configs/qb-barcode-scanner-simulator/{instance}")
def update_barcode_sim(instance: int, request: UpdateBarcodeSimRequest):
    if server is None:
        raise HTTPException(status_code=400, detail="Not connected to server")
    if simulator_configs is None:
        raise HTTPException(status_code=400, detail="Simulator configs not loaded")

    yaml = YAML()
    yaml.preserve_quotes = True
    try:
        path = current_path + "qb-barcode-scanner-simulator/" + frs_version + "-22-04/instances/" + str(instance) + "/config_" + str(instance) + ".yaml"
        instance = instance - 1
        start = simulator_configs[instance]
        print(start)
        simulator_configs[instance]["range_start"] = request.range_start
        simulator_configs[instance]["range_end"] = request.range_end
        with sftp.open(path, 'w') as file:
            yaml.dump(simulator_configs[instance], file)
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
            path = "/var/lib/appcenter/apps/robot-sorting-module/config.yaml"
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
        with sftp.open(floorplan_path, 'w') as file:
            data = floorplan_data
            for zone in data["zones"]:
                zone["constraints"]["max_velocity"] = request.value
            json.dump(data, file, indent=2)
        return {"status": "saved", "max_velocity": request.value}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if getattr(sys, 'frozen', False):
    _base = sys._MEIPASS
else:
    _base = os.path.dirname(os.path.abspath(__file__))
 
_dist = os.path.join(_base, "frontend", "dist")

print(f"MEIPASS: {getattr(sys, '_MEIPASS', 'NOT FROZEN')}")
print(f"Looking for frontend/dist at: {_dist}")
print(f"Path exists: {os.path.exists(_dist)}")

if os.path.exists(_dist):
    app.mount("/", StaticFiles(directory=_dist, html=True), name="static")
else:
    print(f"WARNING: frontend/dist not found at {_dist}")

if __name__ == "__main__":
    import uvicorn
    webbrowser.open("http://localhost:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)