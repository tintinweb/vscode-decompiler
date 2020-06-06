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

class PythonCmd extends BaseCommand {

    getSupportedFileExtensions(){
        return ['.pyo', '.pyc'];
    }

    decompile(uri, progressCallback, token){
        return this.pythonDecompile(uri.fsPath, progressCallback, token);
    }

    pythonDecompile(binaryPath, progressCallback, token) {
        let ctrl = this.ctrl;
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
                let outputFilePath = path.join(projectPath, `${path.basename(binaryPath, path.extname(binaryPath))}${path.extname(binaryPath) == ".pyc" ? ".py" : ".pyo_dis"}`);
                /** 
                 * 
                 * decompile
                 * 
                 * [uncompyle6, -d out, input.pyc/pyo]
                 */

                let cmd = BaseCommand._exec(toolpath, ["-o", projectPath, binaryPath],
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

module.exports = {
    PythonCmd: PythonCmd
};