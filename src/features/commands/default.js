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
const settings = require('../../settings');

const which = require('which');

const {BaseCommand} = require('./_basecommand');

class DefaultCmd extends BaseCommand {

    getSupportedFileExtensions(){
        return ['*'];
    }

    decompile(uri, progressCallback, token){
        //assume binary?
        if (settings.extensionConfig().default.decompiler.selected.includes("idaPro")) {
            return this.idaDecompile(uri.fsPath, progressCallback, token);
        }
        return this.ghidraDecompile(uri.fsPath, progressCallback, token);
    }

    ghidraDecompile(binaryPath, progressCallback, token) {
        let ctrl = this.ctrl;
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
                                        BaseCommand._exec("brew", ["cask", "install", "ghidra"], {
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
                let cmd = BaseCommand._exec(toolpath,
                    [projectPath, "vscode-decompiler",
                        "-import", `${binaryPath}`,
                        "-scriptPath", `${path.join(settings.extension().extensionPath, "scripts")}`,
                        //"-postscript", "ghidra_annotate.py", 
                        "-postScript", `${path.join(settings.extension().extensionPath, "scripts", "ghidra_decompile.py")}`, outputFilePath
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

                                if (process.platform.startsWith("win")) {
                                    decompiled = decompiled.replace(/\r\n/g, '\n'); //fix mixed line-endings
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

    idaDecompile(binaryPath, progressCallback, token) {
        let ctrl = this.ctrl;
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
                let toolpathIs64bit = path.basename(toolpath).includes("64");
                let toolpathOther = toolpathIs64bit ? toolpath.replace(/(ida.?)64(.*)/g, "$1$2") : toolpath.replace(/(ida.?)([^\d].*)/g, "$164$2");  //idaw.exe, idaw64.exe

                let scriptCmd = `${path.join(settings.extension().extensionPath, "scripts", "ida_batch_decompile.py")} -o\\"${projectPath}\\"`;
                if (binaryPath.includes('"')) {
                    return reject({ err: "Dangerous filename" }); //binarypath is quoted.
                }

                let idaArgs = [
                    '-A', '-B', "-M",
                    `-o"${projectPath}"`,
                    `-S"${scriptCmd}"`,
                    `"${binaryPath}"`
                ];

                let idaArgs32 = idaArgs;

                let cwd;  //legacy mode might have to cwd to target folder; otherwise we only cwd on windows when toolpath contains a space; cannot have both.
                if (settings.extensionConfig().default.decompiler.selected.includes("idaPro legacy hexx-plugin")) {
                    // cannot work with IDAPro in a path with spaces :/
                    if (toolpath.includes(" ") && fs.existsSync(toolpath)) {
                        vscode.window.showErrorMessage("This mode does not support IDA being in a location that contains spaces :/ Move IDA to another location (no spaces in path), make it available in PATH or configure another decompilation mode in `vscode-decompiler.default.decompiler.selected`.");
                        return reject({ err: "Incompatible IDA installation path for 'idaPro legacy hexx-plugin' mode." });
                    }
                    // legacy idaPro Method (ida 6.6 hexx plugin)
                    // idaw64.exe -A -M -Ohexx64:-new:calc.exe.cpp:ALL "c:\temp\IDA_6.6\test\calc.exe"
                    // idaw.exe -A -M -Ohexrays:....
                    outputFilePath = path.join(path.dirname(outputFilePath), path.basename(outputFilePath).replace(/\s/g, '_'));
                    idaArgs = [
                        '-A', '-M',
                        `-Ohexx64:-new:${path.basename(outputFilePath)}:ALL`,
                        `"${binaryPath}"`
                    ];
                    idaArgs32 = [
                        '-A', '-M',
                        `-Ohexrays:-new:${path.basename(outputFilePath)}:ALL`,  // thank you hexrays ;)
                        `"${binaryPath}"`
                    ];
                    cwd = projectPath; // cwd to target file as we cannot provide a fullpath as an arg to -new:<fname> :/
                }

                var cmd = BaseCommand._exec(toolpath,
                    toolpathIs64bit ? idaArgs : idaArgs32,
                    {
                        cwd: cwd,
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

                                cmd = BaseCommand._exec(toolpathOther,
                                    toolpathIs64bit == false ? idaArgs : idaArgs32,
                                    {
                                        cwd: cwd,
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

    
}

module.exports = {
    DefaultCmd: DefaultCmd
};