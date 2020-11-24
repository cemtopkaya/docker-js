const https = require("https");
const execSync = require("child_process").execSync;
const path = require("path");

module.exports = class Docker {
  constructor(imageName, containerName, port, volume, DOCKER_HOST = "tcp://localhost:2375") {
      this.imageName = imageName;
      this.containerName = containerName;
      this.port = port;
      this.volume = volume;
      this.DOCKER_HOST = DOCKER_HOST;
      // if (containerName && !this.checkContainerExist()) {
      //   this.createAndRunContainer();
      // }
      // if (containerName && !this.checkContainerUp()) {
      //   this.runContainer();
      // }
  }
  static build(DOCKER_HOST, tag, dockerFilePath = ".", args = []) {
      try {
          const buildArgs = (args ? args : []).map((a) => `--build-arg ${a}`).join(" ");
          const dockerFile = dockerFilePath ? `-f ${dockerFilePath} .` : ".";
          const cmd = `docker build ${buildArgs} -t ${tag} ${dockerFile} --no-cache`;
          console.log(">>> ", cmd);
          return execSync(cmd, { env: { DOCKER_HOST } }).toString();
      }
      catch (error) {
          console.error(">>> docker build Hata fırlattı: ", error);
          throw error;
      }
  }
  static async prepareContainerAndNBI(dockerFilePath, imageArgs, serviceAndPackageName, nbiTestUrl, DOCKER_HOST, imageName, containerName, port, volumes) {
      let container;
      if (typeof DOCKER_HOST === "string" && imageName && containerName && port && volumes) {
          container = new Docker(imageName, containerName, port, volumes);
      }
      else {
          container = DOCKER_HOST;
      }
      if (!Docker.checkImageExist(container.imageName, container.DOCKER_HOST)) {
          console.log("----------- Image yok!");
          Docker.build(container.DOCKER_HOST, container.imageName, dockerFilePath, imageArgs);
      }
      console.log("----------- Image var!");
      container.createAndRunContainer();
      await container.runWebServer(serviceAndPackageName, nbiTestUrl);
  }
  static checkContainerExist(containerName, DOCKER_HOST) {
      try {
          const cmd = `docker ps -a -f name=${containerName} | grep ${containerName}`;
          execSync(cmd, {
              env: { DOCKER_HOST },
          }).toString();
      }
      catch (error) {
          return false;
      }
      return true;
  }
  static checkImageExist(imageName, DOCKER_HOST) {
      try {
          const cmd = `docker image inspect ${imageName}`;
          execSync(cmd, {
              env: { DOCKER_HOST },
          }).toString();
      }
      catch (error) {
          console.error(">>> Yansı kontrolünde istisna: ", error);
          return false;
      }
      return true;
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
          }
          catch (error) {
              console.log("istisna: ", error);
          }
          if (count === maxTryCount) {
              console.log(`>>> ${maxTryCount} kez denedi. Vakit reject vakti`);
              return false;
          }
      }
      return true;
  }
  exec(containerName = this.containerName, command) {
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
      }
      catch (error) {
          console.error(error.message);
          throw error;
      }
  }
  listImages(imageName) {
      try {
          const cmd = `docker images ${imageName ? " | grep " + imageName : ""}`;
          const ls = execSync(cmd, {
              env: { DOCKER_HOST: this.DOCKER_HOST },
          }).toString();
          // console.log(ls);
          return ls;
      }
      catch (error) {
          console.error("Hata: ", error);
          return error;
      }
  }
  listContainers(containerName) {
      try {
          const cmd = `docker ps -a ${containerName ? " -f name=" + containerName : ""}`;
          const ls = execSync(cmd, {
              env: { DOCKER_HOST: this.DOCKER_HOST },
          }).toString();
          // console.log(ls);
          return ls;
      }
      catch (error) {
          return error;
      }
  }
  checkServiceActive(serviceName, containerName = this.containerName) {
      try {
          const cmd = `docker exec -i ${containerName} service ${serviceName} status | grep " active"`;
          console.log(">>> ", cmd);
          execSync(cmd, {
              env: { DOCKER_HOST: this.DOCKER_HOST },
          }).toString();
      }
      catch (error) {
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
      }
      catch (error) {
          return false;
      }
      return true;
  }
  removeContainerByForce(containerName = this.containerName) {
      try {
          if (this.checkContainerUp(containerName)) {
              const cmd = `docker rm -f ${containerName}`;
              execSync(cmd, {
                  env: { DOCKER_HOST: this.DOCKER_HOST },
              }).toString();
          }
      }
      catch (error) {
          return false;
      }
      return true;
  }
  removeContainer(containerName = this.containerName) {
      try {
          if (Docker.checkContainerExist(containerName, this.DOCKER_HOST)) {
              const cmd = `docker rm ${containerName}`;
              execSync(cmd, {
                  env: { DOCKER_HOST: this.DOCKER_HOST },
              }).toString();
          }
      }
      catch (error) {
          return false;
      }
      return true;
  }
  removeImage(imageName = this.imageName) {
      try {
          const cmd = `docker rmi ${imageName}`;
          execSync(cmd, {
              env: { DOCKER_HOST: this.DOCKER_HOST },
          }).toString();
      }
      catch (error) {
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
      }
      catch (error) {
          // console.error(error);
          return false;
      }
      return true;
  }
  startContainer(containerName = this.containerName) {
      try {
          if (Docker.checkContainerExist(containerName, this.DOCKER_HOST)) {
              const komut = `docker start ${containerName}`;
              console.log(">>> komut: ", komut);
              const output = execSync(komut, {
                  env: { DOCKER_HOST: this.DOCKER_HOST },
              });
              console.log(">>>>> Docker run status: " + output);
          }
      }
      catch (error) {
          // console.error(">>> Konteyner başlatılırken hata: ", error);
          return false;
      }
      return true;
  }
  stopContainer(containerName = this.containerName) {
      try {
          if (this.checkContainerUp(containerName)) {
              const komut = `docker stop ${containerName}`;
              console.log(">>> komut: ", komut);
              const output = execSync(komut, {
                  env: { DOCKER_HOST: this.DOCKER_HOST },
              });
              console.log(">>>>> Docker run status: " + output);
          }
      }
      catch (error) {
          // console.error(">>> Konteyner durdurulurken hata: ", error);
          return false;
      }
      return true;
  }
  createAndRunContainer(image = this.imageName, containerName = this.containerName, port = this.port, volume = this.volume || new Map([])) {
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
              });
              console.log(">>>>> Docker run status: " + output.toString());
          }
          else if (!this.checkContainerUp(containerName)) {
              this.startContainer(containerName);
          }
      }
      catch (error) {
          console.log(">>>>> Docker run error: ", error);
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
