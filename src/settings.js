'use strict';
/**
 * @author github.com/tintinweb
 * @license MIT
 *
 *
 * */
/** globals - const */
const vscode = require('vscode');
const path = require('path');
const os = require('os');

function extensionConfig() {
    return vscode.workspace.getConfiguration('vscode-decompiler');
}

function extension() {
    return vscode.extensions.getExtension('tintinweb.vscode-decompiler');
}

/**
* Replace any references to predefined variables in config string.
* https://code.visualstudio.com/docs/editor/variables-reference#_predefined-variables

* Taken from https://github.com/ziglang/vscode-zig/blob/ff6fc577dbcced13c156d151daf56acca7231ce2/src/zigUtil.ts#L20-L55
 */
function handleConfigOption(input) {

    if (!input || typeof input !== "string") {
        return input;
    }

    if (input.includes("${userHome}")) {
        input = input.replaceAll("${userHome}", os.homedir());
    }

    const workspaceFolders = vscode.workspace.workspaceFolders;

    if (workspaceFolders && workspaceFolders.length > 0) {
        input = input.replaceAll("${workspaceFolder}", workspaceFolders[workspaceFolders.length - 1].uri.fsPath);
        input = input.replaceAll("${workspaceFolderBasename}", workspaceFolders[workspaceFolders.length - 1].name);
    }


    input = input.replaceAll("${pathSeparator}", path.sep);
    input = input.replaceAll("${/}", path.sep);
    if (input.includes("${cwd}")) {
        input = input.replaceAll("${cwd}", process.cwd());
    }

    if (input.includes("${env:")) {
        let match;
        while ((match = input.match(/\${env:([^}]+)}/)?.[1])) {
            input = input.replaceAll(`\${env:${match}}`, process.env[match] ?? "");
        }
    }
    return input;
}

module.exports = {
    extensionConfig: extensionConfig,
    extension: extension,
    handleConfigOption: handleConfigOption
};