import * as https from "https";
import { execSync } from "child_process";

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
    public volume: string | null,
    public DOCKER_HOST: string = "tcp://localhost:2375"
  ) {
    if (containerName && !this.checkContainerExist()) {
      this.createAndRunContainer();
    }
    if (containerName && !this.checkContainerUp()) {
      this.runContainer();
    }
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

  exec(containerName: string, command: string): string {
    try {
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

  checkContainerExist(containerName = this.containerName): boolean {
    try {
      const cmd = `docker ps -a -f name=${containerName} | grep ${containerName}`;
      execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  listImages(imageName: undefined | string = undefined): string {
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

  listContainers(containerName: undefined | string = undefined): string {
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

  checkServiceActive(serviceName: string, containerName = this.containerName) {
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

  runContainer(containerName = this.containerName) {
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

  checkContainerUp(containerName = this.containerName) {
    try {
      const cmd = `docker ps -f name=${containerName} | grep ${containerName}`;
      execSync(cmd, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      }).toString();
    } catch (error) {
      return false;
    }
    return true;
  }

  createAndRunContainer(
    image = this.image,
    containerName = this.containerName,
    port = this.port,
    volume = this.volume
  ) {
    try {
      const komut = `docker run -d --privileged --name=${containerName} ${volume} ${port} ${image} `;
      console.log(">>> komut: ", komut);
      const output = execSync(komut, {
        env: { DOCKER_HOST: this.DOCKER_HOST },
      });
      console.log(">>>>> Docker run status: " + output);
    } catch (error) {
      return false;
    }
    return true;
  }

  async runWebServer(serviceName = "cnrnef", url = "localhost:8204/nef-settings/v1/general") {
    if (this.checkServiceActive(serviceName)) {
      await this.isWebServerRunningSync(url);
    }
    console.log("Servisin kontrolü bitti");
  }
}
