import * as https from "https";
import { execSync } from "child_process";
import * as path from "path";

declare global {
  interface String {
    grep(arg: string): string;
    wc(arg: undefined | string): string;
  }
}

String.prototype.wc = function (this: string, arg: undefined | string) {
  try {
    const cmd = `echo ${this} | wc -l `;
    console.log(cmd);
    const result = execSync(cmd).toString();
    console.log(result);
    return result;
  } catch (error) {
    return error;
  }
};
String.prototype.grep = function (this: string, arg: string) {
  try {
    const cmd = `echo ${this} | grep "${arg}"`;
    console.log(cmd);
    const result = execSync(cmd).toString();
    console.log(result);
    return result;
  } catch (error) {
    return error;
  }
};

export class Docker {
  constructor(
    public image: string | null,
    public containerName: string | null,
    public port: string | null,
    public volume: Map<string, string> | null,
    public DOCKER_HOST: string = "tcp://localhost:2375"
  ) {
    // if (containerName && !this.checkContainerExist()) {
    //   this.createAndRunContainer();
    // }
    // if (containerName && !this.checkContainerUp()) {
    //   this.runContainer();
    // }
  }

  static build(DOCKER_HOST = "tcp://localhost:2375", tag: string, dockerFilePath = ".", args: string[] = []): string {
    try {
      const buildArgs = (args ? args : []).map((a) => `--build-arg ${a}`).join(" ");
      const dockerFile = dockerFilePath ? `-f ${dockerFilePath} .` : ".";
      const cmd = `docker build ${buildArgs} -t ${tag} ${dockerFile} --no-cache`;

      console.log(">>> ", cmd);
      return execSync(cmd, { env: { DOCKER_HOST } }).toString();
    } catch (error) {
      console.error(">>> docker build Hata fırlattı: ", error);
      throw error;
    }
  }

  static async prepareContainerAndNBI(
    DOCKER_HOST: string,
    imageName: string,
    dockerFilePath: string,
    imageArgs: string[],
    containerName: string,
    port: string,
    volumes: Map<string, string>,
    serviceAndPackageName: string,
    nbiTestUrl: string
  ) {
    if (!Docker.checkImageExist(imageName, DOCKER_HOST)) {
      Docker.build(DOCKER_HOST, imageName, dockerFilePath, imageArgs);
    }
    const cnef = new Docker(imageName, containerName, port, volumes);
    cnef.createAndRunContainer();
    await cnef.runWebServer(serviceAndPackageName, nbiTestUrl);
  }

  async isWebServerRunningSync(url = "localhost:8204/nef-settings/v1/general") {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    const checkWebServer = () => {
      return new Promise((resolve, reject) => {
        https
          .get(`https://${url}`, (res) => {
            console.log(">>> Sunucu cevap verdi: " + res.statusCode);
            resolve(true);
          })
          .on("error", (e) => {
            switch (e.message) {
              case "socket hang up":
              case "unable to verify the first certificate": {
                console.log(">>> Sunucu ayaklandı, çıkabiliriz");
                return resolve(true);
              }
              case " Client network socket disconnected before secure TLS connection was established ":
              default:
                console.log(`>>> Web sunucu ayakta değil! Tura devam. Hata: '${e.message}'`);
                return reject(false);
            }
          });
      });
    };

    const maxTryCount = 60;
    let count = 0;
    while (count++ < maxTryCount) {
      console.log(`>>>>> ${url} Adresine ${count}. istek yapılıyor`);
      try {
        await new Promise((res) => setTimeout(res, 4000));
        const gelen = await checkWebServer();
        console.log(">>> Gelen : ", gelen);
        if (gelen) {
          return gelen;
        }
        console.log(">>> istisna olmadı");
      } catch (error) {
        console.log("istisna: ", error);
      }

      if (count === maxTryCount) {
        console.log(`>>> ${maxTryCount} kez denedi. Vakit reject vakti`);
        return false;
      }
    }
    return true;
  }

  exec(containerName = this.containerName, command: string): string {
    try {
      console.log("Konteyner adı: ", containerName);
      if (!containerName) {
        throw new Error("Konteyner adı boş olamaz!");
      }
      const cmd = `docker exec -i ${containerName} ${command}`;
      console.log(">>> cmd: ", cmd);
      return execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      console.error(error.message);
      throw error;
    }
  }

  static checkContainerExist(containerName: string, DOCKER_HOST: string): boolean {
    try {
      const cmd = `docker ps -a -f name=${containerName} | grep ${containerName}`;
      execSync(cmd, {
        env: { DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  static checkImageExist(imageName: string, DOCKER_HOST: string): boolean {
    try {
      const cmd = `docker image inspect ${imageName}`;
      execSync(cmd, {
        env: { DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  listImages(imageName: undefined | string): string {
    try {
      const cmd = `docker images ${imageName ? " | grep " + imageName : ""}`;
      const ls = execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
      // console.log(ls);
      return ls;
    } catch (error) {
      console.error("Hata: ", error);
      return error;
    }
  }

  listContainers(containerName: undefined | string): string {
    try {
      const cmd = `docker ps -a ${containerName ? " -f name=" + containerName : ""}`;
      const ls = execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
      // console.log(ls);
      return ls;
    } catch (error) {
      return error;
    }
  }

  checkServiceActive(serviceName: string, containerName = this.containerName): boolean {
    try {
      const cmd = `docker exec -i ${containerName} service ${serviceName} status | grep " active"`;
      console.log(">>> ", cmd);
      execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  runContainer(containerName = this.containerName): boolean {
    try {
      const cmd = `docker start ${containerName}`;
      execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  removeContainerByForce(containerName = this.containerName): boolean {
    try {
      if (this.checkContainerUp(containerName)) {
        const cmd = `docker rm -f ${containerName}`;
        execSync(cmd, {
          env: { DOCKER_HOST: this.DOCKER_HOST },
        }).toString();
      }
    } catch (error) {
      return false;
    }
    return true;
  }

  removeContainer(containerName = this.containerName): boolean {
    try {
      if (Docker.checkContainerExist(containerName, this.DOCKER_HOST)) {
        const cmd = `docker rm ${containerName}`;
        execSync(cmd, {
          env: { DOCKER_HOST: this.DOCKER_HOST },
        }).toString();
      }
    } catch (error) {
      return false;
    }
    return true;
  }

  removeImage(imageName = this.image): boolean {
    try {
      const cmd = `docker rmi ${imageName}`;
      execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  checkContainerUp(containerName = this.containerName): boolean {
    try {
      const cmd = `docker ps -f name=${containerName} | grep ${containerName}`;
      execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      // console.error(error);
      return false;
    }
    return true;
  }

  startContainer(containerName = this.containerName): boolean {
    try {
      if (Docker.checkContainerExist(containerName, this.DOCKER_HOST)) {
        const komut = `docker start ${containerName}`;
        console.log(">>> komut: ", komut);
        const output = execSync(komut, {
          env: { DOCKER_HOST: this.DOCKER_HOST },
        });
        console.log(">>>>> Docker run status: " + output);
      }
    } catch (error) {
      // console.error(">>> Konteyner başlatılırken hata: ", error);
      return false;
    }
    return true;
  }

  stopContainer(containerName = this.containerName): boolean {
    try {
      if (this.checkContainerUp(containerName)) {
        const komut = `docker stop ${containerName}`;
        console.log(">>> komut: ", komut);
        const output = execSync(komut, {
          env: { DOCKER_HOST: this.DOCKER_HOST },
        });
        console.log(">>>>> Docker run status: " + output);
      }
    } catch (error) {
      // console.error(">>> Konteyner durdurulurken hata: ", error);
      return false;
    }
    return true;
  }

  createAndRunContainer(
    image = this.image,
    containerName = this.containerName,
    port = this.port,
    volume = this.volume || new Map([])
  ): boolean {
    try {
      console.log("----------------------------");
      console.log(execSync("echo %cd%").toString());
      console.log("var currentPath = process.cwd(): ", process.cwd());
      console.log("console.log(__dirname):", __dirname);
      console.log(path.dirname(__filename));
      console.log("----------------------------");
      const isWin = process.platform === "win32";
      const volumeStr = Array.from(volume.keys())
        .map((k) => `-v "${isWin ? k.replace("$(pwd)", "%cd%") : k.replace("%cd%", "$(pwd)")}:${volume.get(k)}"`)
        .join(" ");
      if (!Docker.checkContainerExist(containerName, this.DOCKER_HOST)) {
        const komut = `docker run  ${volumeStr} -d --privileged --name=${containerName} ${port} ${image} `;
        console.log(">>> komut: ", komut);
        const output = execSync(komut, {
          env: { DOCKER_HOST: this.DOCKER_HOST },
          // stdio: "ignore",
        });
        console.log(">>>>> Docker run status: " + output.toString());
      } else if (!this.checkContainerUp(containerName)) {
        this.startContainer(containerName);
      }
    } catch (error) {
      console.log(">>>>> Docker run error: ", error);
      return false;
    }
    return true;
  }

  async runWebServer(serviceName = "cnrnef", url = "localhost:8204/nef-settings/v1/general"): Promise<void> {
    if (this.checkServiceActive(serviceName)) {
      await this.isWebServerRunningSync(url);
    }
    console.log("Servisin kontrolü bitti");
  }
}
