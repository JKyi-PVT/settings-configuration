#!/usr/bin/python3

import paramiko
# import time
# import threading
import streamlit as st
#import nmap
#from multiprocessing.pool import ThreadPool
#import io
import os
import requests
import sys
import shutil
# from stat import S_ISDIR, S_ISREG
# import datetime
from ruamel.yaml import YAML
# import logging
# import traceback
import json

LIST = [50,60,70,80,90]
config_files = ["appcenter", "arq-fipp", "arq-gp", "device-configurator", "device-storage", "qb-api", "qb-barcode-scanner-simulator", "qb-ds", "qb-frontend", "qb-logic", "qb-storage", "qb-tcp-bridge", "system-portal", "task-queue"]

def ensure_streamlit_config():
    user_config_dir = os.path.expanduser("~/.streamlit")
    bundled_config_dir = os.path.join(getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__))), ".streamlit")
    os.makedirs(user_config_dir, exist_ok=True)
    shutil.copyfile(os.path.join(bundled_config_dir, "config.toml"),
                    os.path.join(user_config_dir, "config.toml"))



def adjust_server_configs(application):
    yaml = YAML()
    yaml.preserve_quotes = True

    data = st.session_state.configs[application]

    path = st.session_state.current_path + application + "/config.yaml"
    if st.session_state.testing_on_server == True:
        file = st.session_state.sftp.open(path, "w")
    else:
        file = open(path, "w")

    with file:
        yaml.dump(data, file)



# def get_barcode_sim_values(count):
#     yaml = YAML()
#     yaml.preserve_quotes = True

#     value = []
#     PATH = st.session_state.current_path + "qb-barcode-scanner-simulator" + "/7.1.0-22-04/instances/" + count + "/config_" + count + ".yaml"

#     if st.session_state.testing_on_server == True:
#         file = st.session_state.sftp.open(PATH, "r")
#     else:
#         file = open(PATH, "r")
  
#     with file as ExistingYAML:
#         data = yaml.load(ExistingYAML)
#         value.append(data["range_start"])
#         value.append(data["range_end"])
        # 
    # return value

def adjust_barcode_sim():
    yaml = YAML()
    yaml.preserve_quotes = True
    
    data = st.session_state.simulator_configs

    for i in range(st.session_state.barcode_sim_instances):
        path = st.session_state.current_path + "qb-barcode-scanner-simulator" + "/7.1.0-22-04/instances/" + f"{i+1}" + "/config_" + f"{i+1}" + ".yaml"
        if st.session_state.testing_on_server == True:
            file = st.session_state.sftp.open(path, 'w')
        else:
            file = open(path, 'w')
        
        current_file_data = st.session_state.simulator_configs[i]
        with file:
            yaml.dump(current_file_data, file)

def get_all_active_robots():
    robots = requests.get('http://192.168.9.2:6019/enabled_robots').json()
    connected_ids = [robot_id for robot_id, data in robots.items() if data.get("connected")]
    robot_ip_list = []
    for connected_id in connected_ids:
        robot_ip_list.append(int(connected_id[2:]))
    print("Found Robots: " + str(robot_ip_list))
    st.session_state.msg.toast("Found Robots: " + str(robot_ip_list))
    st.session_state.ip_list = robot_ip_list

def connect_to_server(password):
    print('Attempting connection: 192.168.9.2')
    st.session_state.msg.toast('Attempting connection: 192.168.9.2')
    server = paramiko.SSHClient()
    server.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    server.connect('192.168.9.2', username='pvadmin', password=password)
    print('Connected to Server.')
    st.session_state.msg.toast('Connected to Server.')
    return server

def get_config_data():

    configs = {}
    for file in config_files:
        yaml = YAML()
        yaml.preserve_quotes = True
    
        path = st.session_state.current_path + file + "/config.yaml"
        if st.session_state.testing_on_server == True:
            yaml_file = st.session_state.sftp.open(path, "r")
        else:
            yaml_file = open(path, "r")
        
        with yaml_file:
            data = yaml.load(yaml_file)
        
        configs[file] = data

    if configs:
        st.session_state.configs = configs
    else:
        print("No data found")
    
    
    paths = None
    if st.session_state.testing_on_server == True:

        # The shell command to count directories.
        # find: searches for entries
        # -maxdepth 1: limits search to the current directory only
        # -type d: searches for directories
        # wc -l: counts the number of lines (each line is a directory name)
        paths = st.session_state.current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances"
        command = f"find {paths} -maxdepth 1 -type d | wc -l"
        
        # Execute the command
        stdin, stdout, stderr = st.session_state.server.exec_command(command)
        
        # Read the output and convert to an integer
        count_str = stdout.read().decode('utf-8').strip()
        count = int(count_str)
        
        # The 'find' command for the specified path will include the path itself 
        # in the count, so we subtract 1 for the actual number of subdirectories.
        st.session_state.barcode_sim_instances = count - 1
    else:
        paths = os.walk(st.session_state.current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances")
        st.session_state.barcode_sim_instances = (len(next(paths)[1]))
    
    simulator_files = {}
    
    for i in range (st.session_state.barcode_sim_instances):
        yaml = YAML()
        yaml.preserve_quotes = True

        instance = i + 1

        simulator_path = st.session_state.current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances/" + f"{i+1}" + "/config_" + f"{i+1}"  + ".yaml"

        if st.session_state.testing_on_server == True:
            file = st.session_state.sftp.open(simulator_path, "r")
        else:
            file = open(simulator_path, "r")
        
        data = yaml.load(file)

        simulator_files[i] = data

    st.session_state.simulator_configs = simulator_files

def get_scenario_values():

    if not st.session_state.testing_on_server:
        st.session_state.floorplan_path = st.session_state.current_path + "/flooplans/floorplan.json"
        st.session_state.sortplan_path = st.session_state.current_path + "/sortplans/sortplan_no_mirror.json"
    else:
        qb_storage = st.session_state.configs["qb-storage"]
        if "path" not in qb_storage["floorplan_file"]:
            st.session_state.floorplan_path = qb_storage["floorplan_file"]
        else:
            st.session_state.floorplan_path = qb_storage["floorplan_file"]["path"]
        if "path" not in qb_storage["sortplan_file"]:
            st.session_state.sortplan_path = qb_storage["sortplan_file"]
        else:
            st.session_state.sortplan_path = qb_storage["sortplan_file"]["path"]

    with st.session_state.sftp.open(st.session_state.floorplan_path, 'r') as floorplan_file:
        st.session_state.floorplan_data = json.load(floorplan_file)
        first_value = next(iter(st.session_state.floorplan_data["zones"]))
        st.session_state.max_velocity = float(first_value["constraints"]["max_velocity"])
    
    with st.session_state.sftp.open(st.session_state.sortplan_path, 'r') as sortplan_file:
        data = json.load(sortplan_file)
        for node in data:
            value = data[node].get("sub_directions")
            if value is None:
                continue
            else:
                bin_number = list(data[node]["sub_directions"].keys())[0]
                if bin_number == 'reject':
                    bin_number = 0
                if int(bin_number) > st.session_state.max_destinations:
                    st.session_state.max_destinations = int(bin_number)

def get_robot_configs(server):
    robot_ip_list = st.session_state.ip_list
    robot_sftp_list = {}
    for number in robot_ip_list:
        robot_client = paramiko.SSHClient()
        robot_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        robot_ip = "192.168.8." + str(number + 30)

        transport = server.get_transport()
        local_addr = ('127.0.0.1', 22)
        dest_addr = (robot_ip, 22)
        try:
            print('Attempting connection: ' + robot_ip)
            st.session_state.msg.toast('Attempting connection: ' + robot_ip)
            channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)
            robot_client.connect('localhost', port=1234, username='pvadmin', password=st.session_state.password, sock=channel, banner_timeout=200)
            sftp = robot_client.open_sftp()
            robot_sftp_list[robot_ip] = sftp
        except Exception as e:
            print(str(e))
            print("Could not connect to robot: " + robot_ip)
            st.session_state.msg.toast("Could not connect to robot: " + robot_ip)
            continue
        yaml = YAML()
        yaml.preserve_quotes = True
    
        path = "/var/lib/appcenter/apps/robot-sorting-module/config.yaml"
        with sftp.open(path, "r") as file:
            data = yaml.load(file)
        st.session_state.sorting_module_configs[robot_ip] = data
    st.session_state.robot_sftp_list = robot_sftp_list
    get_all_active_robots()

def adjust_speed(value):

    with open(st.session_state.floorplan_path, 'w') as file:
        data = st.session_state.floorplan_data
        for zone in data["zones"]:
            zone["constraints"]["max_velocity"] = value
        # file.seek(0)
        json.dump(data, file, indent=2)
        # file.truncate()
    


def turn_payload_detection(turn_on, robot_list):
    for robot in robot_list:
        robot_ip = '192.168.8.' + str(int(robot + 30))
        data = st.session_state.sorting_module_configs[robot_ip]
        data["payload_detection"] = turn_on

        yaml = YAML()
        yaml.preserve_quotes = True

        with st.session_state.robot_sftp_list[robot_ip].open("/var/lib/appcenter/apps/robot-sorting-module/config.yaml", 'w') as file:
            yaml.dump(data, file)

            
    

if __name__ == "__main__":
    ensure_streamlit_config()
    st.set_page_config(page_title='PVT Settings/Configurations', layout = 'wide', initial_sidebar_state = 'auto')
    st.title("Prime Vision Technology Settings/Configuration UI")

    # Server related
    if "server" not in st.session_state:
        st.session_state.server = None
    if "sftp" not in st.session_state:
        st.session_state.sftp = None
    if "password" not in st.session_state:
        st.session_state.password = ""    
    if "testing_on_server" not in st.session_state:
        st.session_state.testing_on_server = None
    if "current_path" not in st.session_state:
        st.session_state.current_path = None
    if "floorplan_path" not in st.session_state:
        st.session_state.floorplan_path = None
    if "sortplan_path" not in st.session_state:
        st.session_state.sortplan_path = None


    # Server configs
    if "configs" not in st.session_state:
        st.session_state.configs = None
    if "simulator_configs" not in st.session_state:
        st.session_state.simulator_configs = None
    if "floorplan_data" not in st.session_state:
        st.session_state.floorplan_data = None
    if "barcode_sim_instances" not in st.session_state:
        st.session_state.barcode_sim_instances = None
    if "max_destinations" not in st.session_state:
        st.session_state.max_destinations = 0
    if "max_velocity" not in st.session_state:
        st.session_state.max_velocity = 1.0

    # Robot configs
    if "robot_sftp_list" not in st.session_state:
        st.session_state.robot_sftp_list = None
    if "ip_list" not in st.session_state:
        st.session_state.ip_list = {}
    if "sorting_module_configs" not in st.session_state:
        st.session_state.sorting_module_configs = {}

    # Misc streamlit values
    if "should_rerun" not in st.session_state:
        st.session_state.should_rerun = False
    if "msg" not in st.session_state:
        st.session_state.msg =  st.toast('Welcome to the Prime Vision Technology Settings/Configuration Application')
    if "awaiting_action" not in st.session_state:
        st.session_state.awaiting_action = None

    if st.session_state.testing_on_server == None:
        st.header("Would you like to connect to a server or test on your personal device?")
        left, right = st.columns(2)
        with left:
            if left.button("Stay on personal device"):
                st.session_state.server = 1
                st.session_state.testing_on_server = False
                st.session_state.current_path = "/home/justin/PVT-Repos/settings-configuration/Indy II Configs and Envs/"
                st.session_state.ip_list = LIST
                st.rerun()
            if right.button("Connect to server"):
                st.session_state.testing_on_server = True
                st.session_state.current_path = "/var/lib/appcenter/apps/"
                st.rerun()

    if st.session_state.server == None and st.session_state.testing_on_server == True:
        st.session_state.password = st.text_input("Enter Server Password", type="password")
        if st.button("Connect to Server", type="primary"):
            try:
                st.session_state.server = connect_to_server(st.session_state.password)
                st.session_state.sftp = st.session_state.server.open_sftp()
                st.session_state.should_rerun = True
            except Exception as e:
                print(str(e))
                if st.session_state.password != "" and st.session_state.server == None:
                    st.error("Could not connect to Prime Vision sorting server. A server connection is required to use this toolbox, so please resolve this issue. Entered password may be incorrect.", icon=None)

    if st.session_state.should_rerun == True:
        st.session_state.should_rerun = False
        get_robot_configs(st.session_state.server)
        st.rerun()

    if st.session_state.server != None:

        get_config_data()
        get_scenario_values()
        
        # if st.session_state.testing_on_server == True:
        #     if st.button("Disconnect from Server", type="primary"):
        #         st.session_state.awaiting_action = "disconnect"
        #     if st.session_state.awaiting_action == "disconnect":
        #         disconnect_confirmation()
            
        
        tab1, tab2, tab3= st.tabs(["Server and Robot Applications", "Server Configs", "Robot Configs"])
        with tab1:
            st.header("Server and Robot Applications", divider="red")
            left, right = st.columns(2)
            left.subheader("Server Apps", divider="red")
            right.subheader("Robot Apps", divider="red")
            with left:
                text, active, disable = st.columns([0.1,0.3,0.3])
                with text:
                    st.subheader(" ")
                    st.write("arq-fipp")
                    st.write("arq-gp")
                    st.write("device-storage")
                    st.write("qb-api")
                    st.write("qb-barcode-sim")
                    st.write("qb-ds")
                    st.write("qb-frontend")
                    st.write("qb-logic")
                    st.write("qb-storage")
                    st.write("qb-tcp-bridge")
                    st.write("system-portal")
                with active:
                    st.subheader("Activate/Deactivate")
                    arq_fipp = st.toggle("activate-arq-fipp", label_visibility="collapsed")
                    arq_gp = st.toggle("activate-arq-qp", label_visibility="hidden")
                    device_storage = st.toggle("activate-device-storage", label_visibility="hidden")
                    qb_api = st.toggle("activate-qb-api", label_visibility="hidden")
                    qb_barcode_sim = st.toggle("activate-qb-barcode-simulator", label_visibility="hidden")
                    qb_dS = st.toggle("activate-qb-ds", label_visibility="hidden")
                    qb_frontend = st.toggle("activate-qb-frontend", label_visibility="hidden")
                    qb_logic = st.toggle("activate-qb-logic", label_visibility="hidden")
                    qb_storage = st.toggle("activate-qb-storage", label_visibility="hidden")
                    qb_tcp_bridge = st.toggle("activate-qb-tcp-bridge", label_visibility="hidden")
                    system_portal = st.toggle("activate-system-portal", label_visibility="hidden")
                with disable:
                    st.subheader("Enable/Disable")
                    arq_fiqq_enable = st.toggle("arq-fipp", label_visibility="collapsed")
                    arq_gp_enable = st.toggle("arq-qp", label_visibility="hidden")
                    device_storage_enable = st.toggle("device-storage", label_visibility="hidden")
                    qb_api_enable = st.toggle("qb-api", label_visibility="hidden")
                    qb_barcode_sim_enable = st.toggle("qb-barcode-simulator", label_visibility="hidden")
                    qb_ds_enable = st.toggle("qb-ds", label_visibility="hidden")
                    qb_frontend_enable = st.toggle("qb-frontend", label_visibility="hidden")
                    qb_logic_enable = st.toggle("qb-logic", label_visibility="hidden")
                    qb_storage_enable = st.toggle("qb-storage", label_visibility="hidden")
                    qb_tcp_bridge_enable = st.toggle("qb-tcp-bridge", label_visibility="hidden")
                    system_portal_enable = st.toggle("system-portal", label_visibility="hidden")
            # with right:
            #     text, active, disable = st.columns([0.2,0.3,0.3])
            #     with text:
            #         st.subheader(" ")
            #         st.write("robot-manager")
            #         st.write("robot-diagnostics")
            #         st.write("robot-sorting-moduble")
            #         st.write("robot-diagnostics-bridge")
            #         st.write("task-queue")
            #     with active:
            #         st.subheader("Activate/Deactivate")
            #         arqFipp = st.toggle("activate-robot-manager", label_visibility="collapsed")
            #         arqGp = st.toggle("activate-robot-diagnostics", label_visibility="hidden")
            #         deviceStorage = st.toggle("activate-robot-sorting-module", label_visibility="hidden")
            #         qbAPI = st.toggle("activate-robot-dianostics-bridge", label_visibility="hidden")
            #         qbBarcodeSim = st.toggle("activate-task-queue", label_visibility="hidden")
            #     with disable:
            #         st.subheader("Enable/Disable")
            #         arqFipp = st.toggle("robot-manager", label_visibility="collapsed")
            #         arqGp = st.toggle("robot-diagnostics", label_visibility="hidden")
            #         deviceStorage = st.toggle("robot-sorting-module", label_visibility="hidden")
            #         qbAPI = st.toggle("robot-dianostics-bridge", label_visibility="hidden")
            #         qbBarcodeSim = st.toggle("task-queue", label_visibility="hidden")
                    
        with tab2:
            st.header("Server Configurations", divider="red")
            st.subheader("Infeed timeout")
            timeout = st.slider("Infeed timeout(sec)", 30.0, 120.0, float(st.session_state.configs["qb-ds"]["input_cell_deactivation_timeout"]))
            st.session_state.configs["qb-ds"]["input_cell_deactivation_timeout"] = timeout
            if tab2.button("Set infeed timeout"):
                adjust_server_configs("qb-ds")

            st.subheader("Load balancing")
            cost_linear = st.number_input("Target cost linear", 0.0, 20.0, st.session_state.configs["arq-gp"]["target_reservation_cost_linear"])
            cost_quad = st.number_input("Target cost quad", 0.0, 20.0, st.session_state.configs["arq-gp"]["target_reservation_cost_quad"])
            st.session_state.configs["arq-gp"]["target_reservation_cost_linear"] = cost_linear
            st.session_state.configs["arq-gp"]["target_reservation_cost_quad"] = cost_quad
            if tab2.button("Set load balancing parameters"):
                adjust_server_configs("arq-gp")

            slider_buttons = []
            for i in range(st.session_state.barcode_sim_instances):
                range_start = st.session_state.simulator_configs[i]["range_start"]
                range_end = st.session_state.simulator_configs[i]["range_end"]
                # current_locations = get_barcode_sim_values(f"{i+1}")
                slider_buttons += (st.slider(f"Barcode simulator {i+1}", 0, st.session_state.max_destinations, [range_start, range_end], key=f"Barcode simulator {i+1}"), )
                st.session_state.simulator_configs[i]["range_start"] = slider_buttons[i][0]
                st.session_state.simulator_configs[i]["range_end"] = slider_buttons[i][1]
            if tab2.button("Set simulator range"):
                adjust_barcode_sim()

        with tab3:
            st.header("Robot Configurations", divider="red")
            # list = [5, 6, 7, 8, 9, 10]
            i = 0
            if st.button("Refresh robot list"):
                if st.session_state.testing_on_server:
                    get_all_active_robots()
                    get_robot_configs(st.session_state.server)
                else:
                    
                    st.session_state.ip_list.append(i+1)
                    print("Before hitting the button" + str(st.session_state.ip_list))
            st.subheader("Select robots")
            all_robots = st.toggle("Select all robots")
            select_robots = st.multiselect("Select which robots you want to configure" , st.session_state.ip_list)

            st.subheader("Payload detection")
            left, right = st.columns(2)
            with left:
                if left.button("Turn on payload detection"):
                    turn_payload_detection(True, select_robots)
            with right:
                if right.button("Turn off payload detection"):
                    turn_payload_detection(False, select_robots)
            st.subheader("Adjust robot speed")
            speed = st.slider("Adjust robot speed", 0.5, 1.5, st.session_state.max_velocity)
            if tab3.button("adjust_speed"):
                adjust_speed(speed)
        
        
