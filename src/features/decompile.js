'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const tmp = require('tmp');
const { spawn } = require('child_process');
const which = require('which');

const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

const settings = require('../settings');
const { DecompileMemFsProvider } = require('./fsProvider');

function normalizePlatformUri(uriString) {
    return uriString.replace(/\\/g, '/');
}

function memFsFromFileSystem(memFs, anchor, srcPath) {

    const getFiles = async function (dir) {
        let vPath = path.relative(srcPath, dir);
        memFs.createDirectory(vscode.Uri.parse(normalizePlatformUri(`decompileFs:/${path.join(anchor, vPath)}`)));


        const subdirs = await readdir(dir);
        const files = await Promise.all(subdirs.map(async (subdir) => {
            const res = path.resolve(dir, subdir);
            if ((await stat(res)).isDirectory()) {
                return getFiles(res);
            } else {
                memFs.writeFile(
                    vscode.Uri.parse(normalizePlatformUri(`decompileFs:/${path.join(anchor, path.relative(srcPath, res))}`)),
                    Buffer.from(fs.readFileSync(res)),
                    { create: true, overwrite: true }
                );

                return res;
            }
        }));
        return files.reduce((a, f) => a.concat(f), []);
    };

    memFs.createDirectory(vscode.Uri.parse(normalizePlatformUri(`decompileFs:/${anchor}`)));
    return getFiles(srcPath);
}


class Tools {

    static _exec(command, args, options) {


        /** windows bugfix #6 - spaces in path */
        let cwd;
        if(process.platform.startsWith("win")) {
            // node childprocess on windows is a mess. executing .bat files auto-spawns a shell and messes up args provided in the array?!
            // therefore we cwd to the toolpath first and exec the command from there. 
            // note: spawns shell -> insecure.
            if(command.includes(" ") && fs.existsSync(command)){
                //space in path & realpath -> cwd to command and just call it from there..
                cwd = path.dirname(command);
                command = path.basename(command);
            }
        }
        /** /windows bugfix #6 */
        const cmd = spawn(command, args, {
            stdio: options.stdio || ['ignore', options.onStdOut ? 'pipe' : 'ignore', options.onStdErr ? 'pipe' : 'ignore'],
            shell: options.shell,
            cwd: cwd
        });
        if (options.onClose) {
            cmd.on('close', options.onClose);
            cmd.on('error', options.onClose);
        }
        if (options.onStdOut) cmd.stdout.on('data', options.onStdOut);
        if (options.onStdErr) cmd.stderr.on('data', options.onStdErr);
        
        return cmd;
    }

    static ghidraDecompile(binaryPath, progressCallback, ctrl, token) {
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.ghidra.path;

            if (!toolpath) {
                switch (process.platform) {
                    case "darwin":
                        let ghidraRun = which.sync('ghidraRun', { nothrow: true });
                        if (ghidraRun) {
                            toolpath = path.join(fs.realpathSync(ghidraRun), "../support/analyzeHeadless");
                            let cfg = settings.extensionConfig();
                            cfg.update("tool.ghidra.path", toolpath);
                            console.log("updated setting: vscode-decompiler.tool.ghidra.path");
                        }
                        if (!toolpath) {
                            let brewAvailable = which.sync('brew', { nothrow: true });
                            if (brewAvailable) {
                                vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. Please run `brew cask install ghidra` or install it from the official website and configure the path in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`", "Install").then(choice => {
                                    if (choice == "Install") {
                                        vscode.window.showInformationMessage("Homebrew: Installing Ghidra... This can take some time...");
                                        Tools._exec("brew", ["cask", "install", "ghidra"], {
                                            onClose: (code) => {
                                                if (code == 0) {
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
                        ghidraRun = which.sync('ghidraRun', { nothrow: true });
                        if (ghidraRun) {
                            toolpath = path.join(fs.realpathSync(ghidraRun), "../support/analyzeHeadless");
                            let cfg = settings.extensionConfig();
                            cfg.update("tool.ghidra.path", toolpath);
                            console.log("updated setting: vscode-decompiler.tool.ghidra.path");
                        }
                        if (!toolpath) {
                            vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. please use your package manager or install it from the official website and configure the path to `<ghidra>/../support/analyzeHeadless` in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`");
                            return reject();
                        }
                        break;
                    default:
                        vscode.window.showWarningMessage("`Ghidra` is required to decompile binaries. please use your package manager or install it from the official website and configure the path to `<ghidra>/../support/analyzeHeadless.bat` in: code -> preferences -> settings -> `vscode-decompiler.tool.ghidra.path`");
                        return reject();
                }
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
                let cmd = Tools._exec(toolpath,
                    [projectPath, "vscode-decompiler",
                        "-import", `${binaryPath}`,
                        "-scriptPath", `${path.join(settings.extension().extensionPath, "scripts")}`,
                        //"-postscript", "ghidra_annotate.py", 
                        "-postscript", "ghidra_decompile.py", outputFilePath
                    ],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                if (!fs.existsSync(outputFilePath)) {
                                    return reject({ err: "Output file not produced" });
                                }
                                let decompiled = `/** 
*  Generator: ${settings.extension().packageJSON.name}@${settings.extension().packageJSON.version} (https://marketplace.visualstudio.com/items?itemName=${settings.extension().packageJSON.publisher}.${settings.extension().packageJSON.name})
*  Target:    ${binaryPath}
**/

${fs.readFileSync(outputFilePath, 'utf8')};`;

                                if(process.platform.startsWith("win")){
                                    decompiled = decompiled.replace(/\r\n/g,'\n'); //fix mixed line-endings
                                }

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

                token.onCancellationRequested(() => {
                    cmd.kill("SIGKILL");
                    console.log(`${cmd.pid} - process killed - ${cmd.killed}`);
                });
            });
        });
    }

    static idaDecompile(binaryPath, progressCallback, ctrl, token) {
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.idaPro.path;

            if (!toolpath) {
                vscode.window.showWarningMessage("`IdaPro` is required to decompile binaries. please configure the path to `<ida>/ida[wl].exe` in: code -> preferences -> settings -> `vscode-decompiler.tool.idaPro.path`");
                return reject();
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
                let outputFilePath = path.join(projectPath, `${path.basename(binaryPath, path.extname(binaryPath))}.c`);

                /** 
                 * 
                 * decompile
                 * 
                 * 
                 *  idascript = os.path.abspath(os.path.join(get_download_dir(), "ida_batch_decompile.py"))
                    destination_file = os.path.join(destination, os.path.split(source)[1].rsplit(".", 1)[0] + '.c')

                    decompile_script_cmd = '%s -o\\"%s\\"' % (idascript, destination_file)
                    cmd = [Ida32._get_command(), '-B', '-M', '-S"%s"' % decompile_script_cmd, '"' + source + '"']
                 * 
                 */

                //generate idaw candidates:
                let toolpathOther = path.basename(toolpath).includes("64") ? toolpath.replace(/(ida.?)64(.*)/g, "$1$2") : toolpath.replace(/(ida.?)([^\d].*)/g, "$164$2");  //idaw.exe, idaw64.exe

                let scriptCmd = `${path.join(settings.extension().extensionPath, "scripts", "ida_batch_decompile.py")} -o\\"${projectPath}\\"`;
                if (binaryPath.includes('"')) {
                    return reject({ err: "Dangerous filename" }); //binarypath is quoted.
                }

                var cmd = Tools._exec(toolpath,
                    [
                        '-A', '-B', "-M",
                        `-o"${projectPath}"`,
                        `-S"${scriptCmd}"`,
                        `"${binaryPath}"`
                    ],
                    {
                        shell: true, /* dangerous :/ filename may inject stuff? */
                        onClose: (code) => {
                            if (code == 0) {
                                if (!fs.existsSync(outputFilePath)) {
                                    return reject({ err: "Output file not produced" });
                                }

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
                                cleanupCallback();
                            } else {
                                //try other idaw variant (idaw -> idaw64)
                                //******************************* UGLY COPY PASTA */

                                cmd = Tools._exec(toolpathOther,
                                    [
                                        '-A', '-B', "-M",
                                        `-o"${projectPath}"`,
                                        `-S"${scriptCmd}"`,
                                        `"${binaryPath}"`
                                    ],
                                    {
                                        shell: true, /* dangerous :/ filename may inject stuff? */
                                        onClose: (code) => {
                                            if (code == 0) {
                                                if (!fs.existsSync(outputFilePath)) {
                                                    return reject({ err: "Output file not produced" });
                                                }

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
                                                //try other idaw variant (idaw -> idaw64)
                                                reject({ type: "single", code: code, err: "Failed to run decompiler" });

                                            }
                                            cleanupCallback();
                                        }
                                    }
                                );
                                token.onCancellationRequested(() => {
                                    cmd.kill("SIGKILL");
                                    console.log(`${cmd.pid} - process killed - ${cmd.killed}`);
                                });
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

    static jdcliDecompile(binaryPath, progressCallback, ctrl, token) {
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
                let cmd = Tools._exec(toolpath, ["--outputDir", projectPath, binaryPath],
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

                token.onCancellationRequested(() => {
                    cmd.kill("SIGKILL");
                    console.log(`${cmd.pid} - process killed - ${cmd.killed}`);
                });

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

    static jadxDecompile(binaryPath, progressCallback, ctrl, token) {
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
                let cmd = Tools._exec(toolpath, ["-d", projectPath, binaryPath],
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

    static pythonDecompile(binaryPath, progressCallback, ctrl, token) {
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.uncompyle.path;

            console.log(toolpath);
            tmp.setGracefulCleanup();

            let options = {
                unsafeCleanup: true
            };

            // create temp-project dir
            tmp.dir(options, (err, projectPath, cleanupCallback) => {
                if (err) throw err;

                console.log('Project Directory: ', projectPath);
                let outputFilePath = path.join(projectPath, `${path.basename(binaryPath, path.extname(binaryPath))}${path.extname(binaryPath)==".pyc"? ".py" : ".pyo_dis"}`);
                /** 
                 * 
                 * decompile
                 * 
                 * [uncompyle6, -d out, input.pyc/pyo]
                 */

                let cmd = Tools._exec(toolpath, ["-o", projectPath, binaryPath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                /* move all output files to memfs */
                                if (!fs.existsSync(outputFilePath)) {
                                    return reject({ err: "Output file not produced" });
                                }

                                const decompiled = `'''
/*
*  Generator: ${settings.extension().packageJSON.name}@${settings.extension().packageJSON.version} (https://marketplace.visualstudio.com/items?itemName=${settings.extension().packageJSON.publisher}.${settings.extension().packageJSON.name})
*  Target:    ${binaryPath}
**/
'''

${fs.readFileSync(outputFilePath, 'utf8')};`;

                                ctrl.memFs.writeFile(
                                    vscode.Uri.parse(`decompileFs:/${path.basename(binaryPath)}.py`),
                                    Buffer.from(decompiled),
                                    { create: true, overwrite: true }
                                );

                                resolve({
                                    code: code,
                                    data: decompiled,
                                    memFsPath: `decompileFs:/${path.basename(binaryPath)}.py`,
                                    type: "single",
                                    language: "py"
                                });
                                cleanupCallback();
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

            if (!fs.existsSync(uri.fsPath)) {
                vscode.window.showErrorMessage(`Cannot decompile: ${uri.fsPath}. File does not exist.`);
                return;
            }

            progress.report({ increment: 0 });

            return this.decompile(
                uri, 
                (msg) => {
                    if (Array.isArray(msg) && msg.length == 3) {
                        progress.report({ message: `${msg[2]} (${msg[0]}/${msg[1]})`, increment: 100 / parseInt(msg[1]) });
                    }
                    else if ((!!msg) && (msg.constructor === Object)) {
                        //object
                        progress.report(msg);
                    }

                },
                token);
        });
    }

    decompile(uri, progressCallback, token) {

        switch (path.extname(uri.fsPath)) {
            case '.apk':
                if (settings.extensionConfig().apk.decompiler.selected == "jd-cli") {
                    progressCallback({ message: "unpacking...", increment: 2 });
                    return Tools.dex2jarConvert(uri.fsPath).then(jarFile => {
                        progressCallback({ message: "decompiling classes... (this may take some time)", increment: 5 });
                        return Tools.jdcliDecompile(jarFile, progressCallback, this, token);
                    });
                }
                //default: jadx
                return Tools.jadxDecompile(uri.fsPath, progressCallback, this, token);
            case '.class':
            case '.jar':
                if (settings.extensionConfig().java.decompiler.selected == "jd-cli") {
                    return Tools.jdcliDecompile(uri.fsPath, progressCallback, this, token);
                }
                return Tools.jadxDecompile(uri.fsPath, progressCallback, this, token);
            case '.pyo':
            case '.pyc':
                return Tools.pythonDecompile(uri.fsPath, progressCallback, this, token);
            default:
                //assume binary?
                if (settings.extensionConfig().default.decompiler.selected.includes("idaPro")) {
                    return Tools.idaDecompile(uri.fsPath, progressCallback, this, token);
                }
                return Tools.ghidraDecompile(uri.fsPath, progressCallback, this, token);
        }
    }

    reveal() {
        return vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse("decompileFs:/"), name: "🔍Decompiler!" });
    }

}

module.exports = {
    DecompileCtrl: DecompileCtrl
};