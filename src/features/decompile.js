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

        return cmd;
    }

    static ghidraDecompile(binaryPath, progressCallback, ctrl) {
        return new Promise((resolve, reject) => {
            // ./support/analyzeHeadless /tmp/ghidratest ghidratest -import $(which cat) -postscript ghidra_decompile.py test.cpp
            //settings.extensionConfig().tool.ghidra.path |
            let toolpath = settings.extensionConfig().tool.ghidra.path;

            if (!toolpath || !fs.existsSync(toolpath)) {
                if (Tools._checkCommand(toolpath).status !== null) {
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
                Tools._exec(toolpath,
                    [projectPath, "vscode-decompiler",
                        "-import", binaryPath,
                        "-postscript", path.join(settings.extension().extensionPath, "./scripts/ghidra_decompile.py"), outputFilePath],
                    {
                        onClose: (code) => {
                            if (code == 0) {
                                const decompiled = `/** 
*  Generator: ${settings.extension().packageJSON.name}@${settings.extension().packageJSON.version} 
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
                progressCallback({ message: "unpacking...", increment: 2 });
                return Tools.dex2jarConvert(uri.fsPath).then(jarFile => {
                    progressCallback({ message: "decompiling classes... (this may take some time)", increment: 5 });
                    return Tools.jdcliDecompile(jarFile, progressCallback, this);
                });
            case '.class':
            case '.jar':
                return Tools.jdcliDecompile(uri.fsPath, progressCallback, this);
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
