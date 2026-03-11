import json
from ruamel.yaml import YAML
import os
import subprocess
def parse_json():
    with open("/home/justin/PVT-Repos/settings-configuration/Indy II Configs and Envs/flooplans/floorplan.json", 'r+') as file:
        data = json.load(file)
        # for zone in data["zones"]:
        #     zone["constraints"]["max_velocity"] = 1.1
        # file.seek(0)
        # json.dump(data, file, indent=2)
        # file.truncate()
        first_value = next(iter(data["zones"]))
        print(first_value["constraints"]["max_velocity"])

def find_max_destinations():
    with open("/home/justin/PVT-Repos/settings-configuration/Indy II Configs and Envs/sortplans/sortplan_good.json", "r") as file:
        data = json.load(file)
        max_value = 0
        for node in data:
            value = data[node].get("sub_directions")
            if value is None:
                continue
            else:
                bin_number = list(data[node]["sub_directions"].keys())[0]
                if bin_number == 'reject':
                    bin_number = 0
                if int(bin_number) > max_value:
                    max_value = int(bin_number)
        print(max_value)

def find_paths():
    yaml = YAML()
    yaml.preserve_quotes = True
    with open("/home/justin/PVT-Repos/settings-configuration/Indy II Configs and Envs/qb-storage/config.yaml", "r") as file:
        data = yaml.load(file)
        if "path" not in data["floorplan_file"]:
            print(data["floorplan_file"])

name = input("Enter a string: ")

# match = "appcenter"

# start = name.find(match)
# stop = len(match)
# print(name[start:start+stop])

result = subprocess.Popen(["systemctl", "list-units", "--type=service"], stdout=subprocess.PIPE, text=True, bufsize=1)

grep_process = subprocess.Popen(["grep", name], stdin=result.stdout, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=1)

result.stdout.close()

output, error = grep_process.communicate()
print(output.strip().split(" ")[0])

# all_raw_service = result.stdout

# for line in result.stdout:
#     # print(line.strip().split(" ")[0])
#     service = line.strip().split(" ")[0]
#     match = "systemd"
#     start = service.find(match)
#     stop = len(match)
#     print(service[start:start+stop])

    
# find_paths()


# find_max_destinations()


# parse_json()