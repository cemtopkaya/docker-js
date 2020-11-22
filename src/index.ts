import { Docker } from "./docker";
import { execSync } from "child_process";

const containerName = "cnf";
const port = "-p 8204:8204";
const root = "/c/_Projects/_ÇINAR/_e2e_/gui_nef_nrf_nssf/projects/cinar/cn-nef/e2e";
let volume = ` -v ${root}/nef-conf/settings.json:/opt/cinar/nef/settings.json`;
volume += ` -v ${root}/nef-conf/localhost.crt:/opt/cinar/certificate/localhost.crt`;
volume += ` -v ${root}F/nef-conf/localhost.key:/opt/cinar/certificate/localhost.key`;
const image = "cinar/nef";

let DOCKER_HOST = "";
DOCKER_HOST = "tcp://192.168.13.183:2375";
DOCKER_HOST = "tcp://localhost:2375";

// new Docker(image, containerName, port, volume, DOCKER_HOST).listContainers();
let result = "";
//result = new Docker(image, null, port, volume, DOCKER_HOST).exec("cjcinar", "ls /opt/cinar/");

result = new Docker(image, null, port, volume, DOCKER_HOST).build("cemtest", "./src/multi_stage_tek_dockerfile");

console.log(result);
// console.log(execSync("cd.. && pwd && cd..").toString());
// console.log(
//   new Docker(null, null, null, null, "tcp://192.168.13.183:2375")
//     // .checkContainerExist("dream")
//     .listContainers()
// );
