'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
const vscode = require('vscode');
const path = require('path');
const { promisify } = require('util');
const fs = require('fs');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);
const tmp = require('tmp');
const { spawn, spawnSync } = require('child_process');
const which = require('which');

const settings = require('../settings');

const { DecompileMemFsProvider } = require('./fsProvider');


function memFsFromFileSystem(memFs, anchor, srcPath) {

    const getFiles = async function (dir) {
        let vPath = path.relative(srcPath, dir);
        memFs.createDirectory(vscode.Uri.parse(`decompileFs:/${path.join(anchor, vPath)}`));


        const subdirs = await readdir(dir);
        const files = await Promise.all(subdirs.map(async (subdir) => {
            const res = path.resolve(dir, subdir);
            if ((await stat(res)).isDirectory()) {
                return getFiles(res);
            } else {
                memFs.writeFile(
                    vscode.Uri.parse(`decompileFs:/${path.join(anchor, path.relative(srcPath, res))}`),
                    Buffer.from(fs.readFileSync(res)),
                    { create: true, overwrite: true }
                );

                return res;
            }
        }));
        return files.reduce((a, f) => a.concat(f), []);
    };

    memFs.createDirectory(vscode.Uri.parse(`decompileFs:/${anchor}`));
    return getFiles(srcPath);
}


class Tools {

    static _checkCommand(command) {
        return spawnSync(command, ["-v"]);

    }

    static _exec(command, args, options) {
        const cmd = spawn(command, args, {
            stdio: options.stdio || ['ignore', options.onStdOut ? 'pipe' : 'ignore', options.onStdErr ? 'pipe' : 'ignore']
        });
        if (options.onClose) cmd.on('close', options.onClose);
        if (options.onStdOut) cmd.stdout.on('data', options.onStdOut);
        if (options.onStdErr) cmd.stderr.on('data', options.onStdErr);
        cmd.on('error', options.onClose);

        return cmd;
    }

    static ghidraDecompile(binaryPath, progressCallback, ctrl) {
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.ghidra.path;

            if (!toolpath) {
                switch(process.platform){
                    case "darwin": 
                        let ghidraRun = which.sync('ghidraRun', {nothrow: true});
                        if(ghidraRun){
                            toolpath = path.join(fs.realpathSync(ghidraRun), "../support/analyzeHeadless");
                            let cfg = settings.extensionConfig();
                            cfg.update("tool.ghidra.path", toolpath);
                            console.log("updated setting: vscode-decompiler.tool.ghidra.path");
                        }
                        if(!toolpath){
                            let brewAvailable = which.sync('brew', {nothrow: true});
                            if(brewAvailable){
                                vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. Please run `brew cask install ghidra` or install it from the official website and configure the path in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`", "Install").then(choice => {
                                    if(choice=="Install"){
                                        vscode.window.showInformationMessage("Homebrew: Installing Ghidra... This can take some time...");
                                        Tools._exec("brew", ["cask", "install", "ghidra"], {
                                            onClose: (code) => {
                                                if(code==0){
                                                    vscode.window.showInformationMessage("Homebrew: Ghidra installed.");
                                                    vscode.commands.executeCommand("vscode-decompiler.decompile", vscode.Uri.parse(binaryPath)); // restart analysis
                                                } else {
                                                    vscode.window.showWarningMessage("Homebrew: Ghidra install failed. Please install it manually.");
                                                }
                                            }
                                        });
                                    }
                                });
                            } else {
                                vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. Please run `brew cask install ghidra` or install it from the official website and configure the path in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`");
                            }
                            return reject();
                        }
                        break;
                    case "linux":
                    case "freebsd":
                    case "openbsd":
                        ghidraRun = which.sync('ghidraRun', {nothrow: true});
                        if(ghidraRun){
                            toolpath = path.join(fs.realpathSync(ghidraRun), "../support/analyzeHeadless");
                            let cfg = settings.extensionConfig();
                            cfg.update("tool.ghidra.path", toolpath);
                            console.log("updated setting: vscode-decompiler.tool.ghidra.path");
                        }
                        if(!toolpath){
                            vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. please use your package manager or install it from the official website and configure the path to `<ghidra>/../support/analyzeHeadless` in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`");
                            return reject();
                        }
                        break;
                    default: 
                        vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. please use your package manager or install it from the official website and configure the path to `<ghidra>/../support/analyzeHeadless.bat` in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`");
                        return reject();
                }
                //process.platform
                ///Users/tintin/workspace/sectools/ghidra_9.1.2_PUBLIC/support/analyzeHeadless
                //brew cask install ghidra
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
                let outputFilePath = tmp.tmpNameSync(options);

                /** 
                 * 
                 * decompile
                 * 
                 */
                Tools._exec(toolpath,
                    [projectPath, "vscode-decompiler",
                        "-import", binaryPath,
                        "-postscript", path.join(settings.extension().extensionPath, "./scripts/ghidra_decompile.py"), outputFilePath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                const decompiled = `/** 
*  Generator: ${settings.extension().packageJSON.name}@${settings.extension().packageJSON.version} (https://marketplace.visualstudio.com/items?itemName=${settings.extension().packageJSON.publisher}.${settings.extension().packageJSON.name})
*  Target:    ${binaryPath}
**/

${fs.readFileSync(outputFilePath, 'utf8')};`;

                                ctrl.memFs.writeFile(
                                    vscode.Uri.parse(`decompileFs:/${path.basename(binaryPath)}.cpp`),
                                    Buffer.from(decompiled),
                                    { create: true, overwrite: true }
                                );

                                resolve({
                                    code: code,
                                    data: decompiled,
                                    memFsPath: `decompileFs:/${path.basename(binaryPath)}.cpp`,
                                    type: "single",
                                    language: "cpp"
                                });
                            } else {
                                reject({ code: code, type: "single" });
                            }
                            cleanupCallback();
                        },
                        onStdErr: (data) => {
                            data = `${data}`;
                            console.log(data);
                            if (progressCallback && data.startsWith("#DECOMPILE-PROGRESS,")) {
                                progressCallback(data.replace("#DECOMPILE-PROGRESS,", "").split(","));
                            }
                        }
                    }
                );
            });
        });
    }

    static jdcliDecompile(binaryPath, progressCallback, ctrl) {
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
                Tools._exec(toolpath, ["--outputDir", projectPath, binaryPath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                /* move all output files to memfs */
                                memFsFromFileSystem(ctrl.memFs, path.basename(binaryPath), projectPath).then(() => {
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
            });
        });
    }

    static dex2jarConvert(binaryPath) {
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.dex2jar.path;
            if (!toolpath) {
                toolpath = path.join(settings.extension().extensionPath, `bundled_tools/dex-tools-2.1-SNAPSHOT/d2j-dex2jar${process.platform.startsWith('win') ? ".bat" : ".sh"}`);
            }

            console.log(toolpath);
            tmp.setGracefulCleanup();

            let options = {
                unsafeCleanup: true
            };

            let outputFilePath = tmp.tmpNameSync(options);

            /** 
             * 
             * decompile
             * 
             * [Dex2Jar._get_command(), '-o', destination, source]
             */
            Tools._exec(toolpath, ["-o", outputFilePath, binaryPath],
                {
                    onClose: (code) => {
                        if (code == 0) {
                            resolve(outputFilePath);
                        } else {
                            reject(code);
                        }
                    }
                }
            );
        });
    }

    static jadxDecompile(binaryPath, progressCallback, ctrl) {
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
                Tools._exec(toolpath, ["-d", projectPath, binaryPath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                /* move all output files to memfs */
                                memFsFromFileSystem(ctrl.memFs, path.basename(binaryPath), projectPath).then(() => {
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
            });
        });
    }
}

class DecompileCtrl {

    constructor() {
        this.memFs = new DecompileMemFsProvider();
    }

    showDecompileWithProgress(uri) {
        return vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Decompiling ${uri.fsPath}`,
            cancellable: true
        }, (progress, token) => {
            token.onCancellationRequested(() => {
                console.log("User canceled the long running operation");
            });

            if(!fs.existsSync(uri.fsPath)){
                vscode.window.showErrorMessage(`Cannot decompile: ${uri.fsPath}. File does not exist.`);
                return;
            }

            progress.report({ increment: 0 });

            return this.decompile(uri, (msg) => {

                if (Array.isArray(msg) && msg.length == 3) {
                    progress.report({ message: `${msg[2]} (${msg[0]}/${msg[1]})`, increment: 100 / parseInt(msg[1]) });
                }
                else if ((!!msg) && (msg.constructor === Object)) {
                    //object
                    progress.report(msg);
                }

            });
        });
    }

    decompile(uri, progressCallback) {

        switch (path.extname(uri.fsPath)) {
            case '.apk':
                if(settings.extensionConfig().apk.decompiler.selected=="jd-cli"){
                    progressCallback({ message: "unpacking...", increment: 2 });
                    return Tools.dex2jarConvert(uri.fsPath).then(jarFile => {
                        progressCallback({ message: "decompiling classes... (this may take some time)", increment: 5 });
                        return Tools.jdcliDecompile(jarFile, progressCallback, this);
                    });
                } 
                //default: jadx
                return Tools.jadxDecompile(uri.fsPath, progressCallback, this);
            case '.class':
            case '.jar':
                if(settings.extensionConfig().java.decompiler.selected=="jd-cli"){
                    return Tools.jdcliDecompile(uri.fsPath, progressCallback, this);
                }
                return Tools.jadxDecompile(uri.fsPath, progressCallback, this);
            default:
                //assume binary?
                return Tools.ghidraDecompile(uri.fsPath, progressCallback, this);
        }
    }

    reveal() {
        return vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse("decompileFs:/"), name: "🔍Decompiler!" });
    }

}

module.exports = {
    DecompileCtrl: DecompileCtrl
};
