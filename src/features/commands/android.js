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

const {JavaCmd} = require('./java');

class AndroidCmd extends JavaCmd {

    getSupportedFileExtensions(){
        return ['.apk'];
    }
    
    decompile(uri, progressCallback, token){
        if (settings.extensionConfig().apk.decompiler.selected == "jd-cli") {
            progressCallback({ message: "unpacking...", increment: 2 });
            return this.dex2jarConvert(uri.fsPath).then(jarFile => {
                progressCallback({ message: "decompiling classes... (this may take some time)", increment: 5 });
                return this.jdcliDecompile(jarFile, progressCallback, token);
            });
        }
        //default: jadx
        return this.jadxDecompile(uri.fsPath, progressCallback, token);
    }

    dex2jarConvert(binaryPath) {
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
            JavaCmd._exec(toolpath, ["-o", outputFilePath, binaryPath],
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

module.exports = {
    AndroidCmd: AndroidCmd
};