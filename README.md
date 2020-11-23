# docker-js
Typescript Docker sınıfıyla nodejs ortamında docker işlemlerini yapar 

```
import { Docker } from "./docker";

const containerName = "backendContainer";
const port = "-p 8204:8204";
const root = "/c/_Projects/_e2e_/main-project/projects/gallery/e2e";
const volumes = new Map<string, string>([
  ["$(pwd)/projects/gallery/e2e/e2e-conf/settings.json", "/opt/appCemt/settings.json"],
  ["$(pwd)/projects/gallery/e2e/e2e-conf/localhost.crt", "/opt/appCemt/certificate/localhost.crt"],
  ["$(pwd)/projects/gallery/e2e/e2e-conf/localhost.key", "/opt/appCemt/certificate/localhost.key"],
]);
const image = "cemt/gallery";

let DOCKER_HOST = "";
DOCKER_HOST = "tcp://192.168.13.183:2375";
DOCKER_HOST = "tcp://localhost:2375";

console.log(
    new Docker(image, containerName, port, volume, DOCKER_HOST).listContainers()
);

console.log(
    Docker.build(DOCKER_HOST, image, "./src/multi_stage_tek_dockerfile", ["NF_PAKET_ADI=cnrnef"])
);

const ctr = new Docker(image, containerName, port, volumes, DOCKER_HOST);
console.log(ctr.createAndRunContainer());
console.log(ctr.runWebServer("backEndServiceName", "localhost:8204/api/v1/photos"));

result = ctr.exec(undefined, "ls /opt/appCemt/");
console.log(result);
console.log(execSync("cd.. && pwd && cd..").toString());
console.log(
  new Docker(undefined, undefined, undefined, undefined, "tcp://192.168.13.183:2375")
    // .checkContainerExist("dream")
    .listContainers()
);
```