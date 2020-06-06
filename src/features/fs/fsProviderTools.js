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
const { promisify } = require('util');
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);


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

module.exports = {
    memFsFromFileSystem: memFsFromFileSystem
};