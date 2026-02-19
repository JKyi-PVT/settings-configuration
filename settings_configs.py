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


def connect_to_server(password):
    print('Attempting connection: 192.168.9.2')
    st.session_state.msg.toast('Attempting connection: 192.168.9.2')
    server = paramiko.SSHClient()
    server.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    server.connect('192.168.9.2', username='pvadmin', password=password)
    print('Connected to Server.')
    st.session_state.msg.toast('Connected to Server.')
    return server

def ensure_streamlit_config():
    user_config_dir = os.path.expanduser("~/.streamlit")
    bundled_config_dir = os.path.join(getattr(sys, '_MEIPASS', os.path.dirname(os.path.abspath(__file__))), ".streamlit")
    os.makedirs(user_config_dir, exist_ok=True)
    shutil.copyfile(os.path.join(bundled_config_dir, "config.toml"),
                    os.path.join(user_config_dir, "config.toml"))

def get_config_values(application, parameter):
    yaml = YAML()
    yaml.preserve_quotes = True

    PATH = st.session_state.current_path + application + "/config.yaml"

    with open(PATH, "r") as ExistingYAML:
        data = yaml.load(ExistingYAML)
        st.session_state[parameter] = data[parameter]

def adjust_server_configs(application, parameter, value):
    yaml = YAML()
    yaml.preserve_quotes = True

    PATH = st.session_state.current_path + application + "/config.yaml"
    with open(PATH, "r") as ExistingYAML:
        data = yaml.load(ExistingYAML)
        data[parameter] = value
    
    with open(PATH, "w") as NewYAML:
        yaml.dump(data, NewYAML)

def get_barcode_sim_values(count):
    yaml = YAML()
    yaml.preserve_quotes = True

    value = []

    PATH = st.session_state.current_path + "qb-barcode-scanner-simulator" + "/7.1.0-22-04/instances/" + count + "/config_" + count + ".yaml"
    with open(PATH, "r") as ExistingYAML:
        data = yaml.load(ExistingYAML)
        value.append(data["range_start"])
        value.append(data["range_end"])
    
    return value

def adjust_barcode_sim(count, value):
    yaml = YAML()
    yaml.preserve_quotes = True

    PATH = st.session_state.current_path + "qb-barcode-scanner-simulator" + "/7.1.0-22-04/instances/" + count + "/config_" + count + ".yaml"
    with open(PATH, "r") as ExistingYAML:
        data = yaml.load(ExistingYAML)
        data["range_start"] = value[0]
        data["range_end"] = value[1]
    
    with open(PATH, "w") as NewYAML:
        yaml.dump(data, NewYAML)

def get_all_active_robots(list_use):
    robots = requests.get('http://192.168.9.2:6019/enabled_robots').json()
    connected_ids = [robot_id for robot_id, data in robots.items() if data.get("connected")]
    robot_ip_list = []
    for connected_id in connected_ids:
        if list_use:
            robot_ip = int(connected_id[2:])
        else:
            robot_ip = '192.168.8.' + str(int(connected_id[2:]) + 30)
        robot_ip_list.append(robot_ip)
    print("Found Robots: " + str(robot_ip_list))
    st.session_state.msg.toast("Found Robots: " + str(robot_ip_list))
    return robot_ip_list

def connect_to_server(password):
    print('Attempting connection: 192.168.9.2')
    st.session_state.msg.toast('Attempting connection: 192.168.9.2')
    server = paramiko.SSHClient()
    server.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    server.connect('192.168.9.2', username='pvadmin', password=password)
    print('Connected to Server.')
    st.session_state.msg.toast('Connected to Server.')
    return server

    

if __name__ == "__main__":
    ensure_streamlit_config()
    st.set_page_config(page_title='PVT Settings/Configurations', layout = 'wide', initial_sidebar_state = 'auto')
    st.title("Prime Vision Technology Settings/Configuration UI")

    if "server" not in st.session_state:
        st.session_state.server = None
    if "password" not in st.session_state:
        st.session_state.password = ""
    if "should_rerun" not in st.session_state:
        st.session_state.should_rerun = False
    if "map_file" not in st.session_state:
        st.session_state.map_file = None
    if "barcode_sim_instances" not in st.session_state:
        st.session_state.barcode_sim_instances = None
    if "testing_on_server" not in st.session_state:
        st.session_state.testing_on_server = None
    if "current_path" not in st.session_state:
        st.session_state.current_path = None
    if "msg" not in st.session_state:
        st.session_state.msg =  st.toast('Welcome to the Prime Vision Technology Settings/Configuration Application')
    if "input_cell_deactivation_timeout" not in st.session_state:
        st.session_state.input_cell_deactivation_timeout = None
    if "target_reservation_cost_linear" not in st.session_state:
        st.session_state.target_reservation_cost_linear = None
    if "target_reservation_cost_quad" not in st.session_state:
        st.session_state.target_reservation_cost_linear = None
    # if "awaiting_action" not in st.session_state:
    #     st.session_state.awaiting_action = None

    if st.session_state.testing_on_server == None:
        st.header("Would you like to connect to a server or test on your personal device?")
        left, right = st.columns(2)
        with left:
            if left.button("Stay on personal device"):
                st.session_state.server = 1
                st.session_state.testing_on_server = False
                st.session_state.current_path = "/home/justin/PVT-Repos/settings-configuration/Indy II Configs and Envs/"
                st.rerun()
            if right.button("Connect to server"):
                st.session_state.testing_on_server = True
                st.session_state.current_path = "/home/pvadmin/envs/"
                st.rerun()

    if st.session_state.server == None and st.session_state.testing_on_server == True:
        st.session_state.password = st.text_input("Enter Server Password", type="password")
        if st.button("Connect to Server", type="primary"):
            try:
                st.session_state.server = connect_to_server(st.session_state.password)
                st.session_state.should_rerun = True
            except Exception as e:
                print(str(e))
                if st.session_state.password != "" and st.session_state.server == None:
                    st.error("Could not connect to Prime Vision sorting server. A server connection is required to use this toolbox, so please resolve this issue. Entered password may be incorrect.", icon=None)

    if st.session_state.should_rerun == True:
        st.session_state.should_rerun = False
        st.rerun()

    if st.session_state.server != None:
        get_config_values("qb-ds", "input_cell_deactivation_timeout")
        get_config_values("arq-gp", "target_reservation_cost_linear")
        get_config_values("arq-gp", "target_reservation_cost_quad")
        st.session_state.barcode_sim_instances = (len(next(os.walk(st.session_state.current_path + "qb-barcode-scanner-simulator/7.1.0-22-04/instances"))[1]))

        if st.session_state.testing_on_server == True:
            if st.button("Disconnect from Server", type="primary"):
                st.session_state.awaiting_action = "disconnect"
            if st.session_state.awaiting_action == "disconnect":
                disconnect_confirmation()
            
        
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
                    arqFipp = st.toggle("activate-arq-fipp", label_visibility="collapsed")
                    arqGp = st.toggle("activate-arq-qp", label_visibility="hidden")
                    deviceStorage = st.toggle("activate-device-storage", label_visibility="hidden")
                    qbAPI = st.toggle("activate-qb-api", label_visibility="hidden")
                    qbBarcodeSim = st.toggle("activate-qb-barcode-simulator", label_visibility="hidden")
                    qbDS = st.toggle("activate-qb-ds", label_visibility="hidden")
                    qbFrontend = st.toggle("activate-qb-frontend", label_visibility="hidden")
                    qbLogic = st.toggle("activate-qb-logic", label_visibility="hidden")
                    qbStorage = st.toggle("activate-qb-storage", label_visibility="hidden")
                    qbTCPBridge = st.toggle("activate-qb-tcp-bridge", label_visibility="hidden")
                    systemPortal = st.toggle("activate-system-portal", label_visibility="hidden")
                with disable:
                    st.subheader("Enable/Disable")
                    arqFiqqEnable = st.toggle("arq-fipp", label_visibility="collapsed")
                    arqGp = st.toggle("arq-qp", label_visibility="hidden")
                    deviceStorage = st.toggle("device-storage", label_visibility="hidden")
                    qbAPI = st.toggle("qb-api", label_visibility="hidden")
                    qbBarcodeSim = st.toggle("qb-barcode-simulator", label_visibility="hidden")
                    qbDS = st.toggle("qb-ds", label_visibility="hidden")
                    qbFrontend = st.toggle("qb-frontend", label_visibility="hidden")
                    qbLogic = st.toggle("qb-logic", label_visibility="hidden")
                    qbStorage = st.toggle("qb-storage", label_visibility="hidden")
                    qbTCPBridge = st.toggle("qb-tcp-bridge", label_visibility="hidden")
                    systemPortal = st.toggle("system-portal", label_visibility="hidden")
            with right:
                text, active, disable = st.columns([0.2,0.3,0.3])
                with text:
                    st.subheader(" ")
                    st.write("robot-manager")
                    st.write("robot-diagnostics")
                    st.write("robot-sorting-moduble")
                    st.write("robot-diagnostics-bridge")
                    st.write("task-queue")
                with active:
                    st.subheader("Activate/Deactivate")
                    arqFipp = st.toggle("activate-robot-manager", label_visibility="collapsed")
                    arqGp = st.toggle("activate-robot-diagnostics", label_visibility="hidden")
                    deviceStorage = st.toggle("activate-robot-sorting-module", label_visibility="hidden")
                    qbAPI = st.toggle("activate-robot-dianostics-bridge", label_visibility="hidden")
                    qbBarcodeSim = st.toggle("activate-task-queue", label_visibility="hidden")
                with disable:
                    st.subheader("Enable/Disable")
                    arqFipp = st.toggle("robot-manager", label_visibility="collapsed")
                    arqGp = st.toggle("robot-diagnostics", label_visibility="hidden")
                    deviceStorage = st.toggle("robot-sorting-module", label_visibility="hidden")
                    qbAPI = st.toggle("robot-dianostics-bridge", label_visibility="hidden")
                    qbBarcodeSim = st.toggle("task-queue", label_visibility="hidden")
                    
        with tab2:
            st.header("Server Configurations", divider="red")
            st.subheader("Infeed timeout")
            timeout = st.slider("Infeed timeout(sec)", 30, 120, st.session_state.input_cell_deactivation_timeout)
            if tab2.button("Set infeed timeout"):
                adjust_server_configs("qb-ds", "input_cell_deactivation_timeout", timeout)

            st.subheader("Load balancing")
            cost_linear = st.number_input("Target cost linear", 0.0, 20.0, st.session_state.target_reservation_cost_linear)
            cost_quad = st.number_input("Target cost quad", 0.0, 20.0, st.session_state.target_reservation_cost_quad)
            if tab2.button("Set load balancing parameters"):
                adjust_server_configs("arq-gp", "target_reservation_cost_linear", cost_linear)
                adjust_server_configs("arq-gp", "target_reservation_cost_quad", cost_quad)

            slider_buttons = []
            for i in range(barcode_sim_instances):
                current_locations = get_barcode_sim_values(f"{i+1}")
                slider_buttons += (st.slider(f"Barcode simulator {i+1}", 0, 181, current_locations, key=f"Barcode simulator {i+1}"), )
            if tab2.button("Set simulator range"):
                for i in range(barcode_sim_instances):
                    adjust_barcode_sim(f"{i+1}", slider_buttons[i])

        with tab3:
            st.header("Robot Configurations", divider="red")
            st.subheader("Select robots")
            all_robots = st.toggle("Select all robots")
            # select_robots = st.multiselect(get_all_active_robots(True))
            select_robots = st.multiselect("Select which robots you want to configure" , [50,60,70])
            st.subheader("Payload detection")
            left, right = st.columns(2)
            with left:
                if left.button("Turn on payload detection"):
                    turn_payload_detection(True, select_robots)
            with right:
                if right.button("Turn off payload detection"):
                    turn_payload_detection(False, select_robots)
            st.subheader("Adjust robot speed")
            adjust_speed = st.slider("Adjust robot speed", 0.5, 1.5, 1.0)
        
        
