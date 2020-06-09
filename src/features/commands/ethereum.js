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

const {BaseCommand} = require('./_basecommand');

class EthereumEvmCmd extends BaseCommand {

    getSupportedFileExtensions(){
        return ['.evm'];
    }

    decompile(uri, progressCallback, token){
        return this.panoramixDecompile(uri.fsPath, progressCallback, token);
    }

    panoramixDecompile(binaryPath, progressCallback, token) {
        let ctrl = this.ctrl;
        return new Promise((resolve, reject) => {
            let toolpath = settings.extensionConfig().tool.python38.path;

            if(!toolpath){
                return reject({ err: "Python3.8 not found. Please specify the path in `code → preferences → settings: vscode-decompiler.tool.python38.path`" });
            }

            let panoramixWorkDir = path.join(require('os').homedir(), ".panoramix");
            if (!fs.existsSync(panoramixWorkDir)){
                console.log("creating panoramix workdir: "+ panoramixWorkDir);
                fs.mkdirSync(panoramixWorkDir);
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
                 * cat test.evm | /usr/local/opt/python@3.8/bin/python3.8 panoramix.py stdin --fast --silent
                 */

                let stdout = [];
                let stderr = [];

                let panoramixPy = path.join(settings.extension().extensionPath, "bundled_tools", "panoramix_a75744cc2e7d1ad4cb3514d172d1872233f645fd", "panoramix.py");

                let cmd = BaseCommand._exec("/usr/local/opt/python@3.8/bin/python3.8", [panoramixPy, "stdin", "--fast"],
                    {
                        cwd: panoramixWorkDir,
                        shell: true,
                        stdio : ['pipe', 'pipe', 'pipe'],
                        onClose: (code) => {
                            if (code == 0) {
                                /* move all output files to memfs */
                                if (!stdout) {
                                    return reject({ err: "Output file not produced" });
                                }

                                let data = stdout.join('\n');
                                data = data.substr(data.indexOf("#  Panoramix ") + 1); //split garbage

                                const decompiled = `'''
/*
*  Generator: ${settings.extension().packageJSON.name}@${settings.extension().packageJSON.version} (https://marketplace.visualstudio.com/items?itemName=${settings.extension().packageJSON.publisher}.${settings.extension().packageJSON.name})
*  Target:    ${binaryPath}
**/
'''

#
#${data.replace(/\x1b\[[0-9;]*m/g,"")};`;

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
                                reject({ code: code, type: "multi", err: stderr.join('\n')});
                            }
                            cleanupCallback();
                        },
                        onStdErr: (data) => {
                            data = `${data}`;
                            console.log(data);
                            stderr.push(data);
                            if (progressCallback) {
                                let funcnamePos = data.indexOf(" Parsing ");
                                if(funcnamePos){
                                    progressCallback({ message: data.substr(funcnamePos + 1), increment: 10 });
                                }
                            }
                        },
                        onStdOut: (data) => {
                            data = `${data}`;
                            console.log(data);
                            stdout.push(data);
                        }
                    }
                );

                let inputData = fs.readFileSync(binaryPath, "utf8");

                //cmd.stdin.setEncoding('utf-8');
                cmd.stdin.end(inputData);
                
                token.onCancellationRequested(() => {
                    cmd.kill("SIGKILL");
                    console.log(`${cmd.pid} - process killed - ${cmd.killed}`);
                });
            });
        });
    }
}

module.exports = {
    EthereumEvmCmd: EthereumEvmCmd
};