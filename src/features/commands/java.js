'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
const path = require('path');
const tmp = require('tmp');
const settings = require('../../settings');

const {BaseCommand} = require('./_basecommand');

class JavaCmd extends BaseCommand {

    getSupportedFileExtensions(){
        return ['.class', '.jar'];
    }

    decompile(uri, progressCallback, token){
        if (settings.extensionConfig().java.decompiler.selected == "jd-cli") {
            return this.jdcliDecompile(uri.fsPath, progressCallback, token);
        }
        return this.jadxDecompile(uri.fsPath, progressCallback, token);
    }

    jdcliDecompile(binaryPath, progressCallback, token) {
        let ctrl = this.ctrl;
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.jdcli.path;

            if (!toolpath) {
                toolpath = path.join(settings.extension().extensionPath, `bundled_tools/jd-cli-1.0.1.Final-dist/jd-cli${process.platform.startsWith('win') ? ".bat" : ""}`);
            }

            console.log(toolpath);
            tmp.setGracefulCleanup();

            let options = {
                unsafeCleanup: true
            };

            // create temp-project dir
            tmp.dir(options, (err, projectPath, cleanupCallback) => {
                if (err) throw err;

                console.log('Project Directory: ', projectPath);

                /** 
                 * 
                 * decompile
                 * 
                 * [JdCli._get_command(), '--outputDir', destination, source]
                 */
                let cmd = BaseCommand._exec(toolpath, ["--outputDir", projectPath, binaryPath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                /* move all output files to memfs */
                                ctrl.memFsFromFileSystem(ctrl.memFs, path.basename(binaryPath), projectPath).then(() => {
                                    resolve({
                                        code: code,
                                        data: null,
                                        memFsPath: `decompileFs:/${path.basename(binaryPath)}`,
                                        type: "multi",
                                        language: "java"
                                    });
                                });
                            } else {
                                reject({ code: code, type: "multi" });
                            }
                            cleanupCallback();
                        },
                        onStdOut: (data) => {
                            data = `${data}`;
                            console.log(data);
                            if (progressCallback) {
                                progressCallback({ message: "java decompile", increment: 4 });
                            }
                        }
                    }
                );

                token.onCancellationRequested(() => {
                    cmd.kill("SIGKILL");
                    console.log(`${cmd.pid} - process killed - ${cmd.killed}`);
                });

            });
        });
    }

    jadxDecompile(binaryPath, progressCallback, token) {
        let ctrl = this.ctrl;
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.jadx.path;

            if (!toolpath) {
                toolpath = path.join(settings.extension().extensionPath, `bundled_tools/jadx-1.1.0/bin/jadx${process.platform.startsWith('win') ? ".bat" : ""}`);
            }

            console.log(toolpath);
            tmp.setGracefulCleanup();

            let options = {
                unsafeCleanup: true
            };

            // create temp-project dir
            tmp.dir(options, (err, projectPath, cleanupCallback) => {
                if (err) throw err;

                console.log('Project Directory: ', projectPath);

                /** 
                 * 
                 * decompile
                 * 
                 * [jadx, -d out, input.dex]
                 */
                let cmd = BaseCommand._exec(toolpath, ["-d", projectPath, binaryPath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                /* move all output files to memfs */
                                ctrl.memFsFromFileSystem(ctrl.memFs, path.basename(binaryPath), projectPath).then(() => {
                                    resolve({
                                        code: code,
                                        data: null,
                                        memFsPath: `decompileFs:/${path.basename(binaryPath)}`,
                                        type: "multi",
                                        language: "java"
                                    });
                                });
                            } else {
                                reject({ code: code, type: "multi" });
                            }
                            cleanupCallback();
                        },
                        onStdOut: (data) => {
                            data = `${data}`;
                            console.log(data);
                            if (progressCallback) {
                                progressCallback({ message: "java decompile", increment: 20 });
                            }
                        }
                    }
                );

                token.onCancellationRequested(() => {
                    cmd.kill("SIGKILL");
                    console.log(`${cmd.pid} - process killed - ${cmd.killed}`);
                });
            });
        });
    }

}

module.exports = {
    JavaCmd: JavaCmd
};