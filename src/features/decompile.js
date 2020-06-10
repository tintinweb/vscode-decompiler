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

const { DecompileMemFsProvider } = require('./fs/fsProvider');
const { memFsFromFileSystem } = require('./fs/fsProviderTools');
const { CommandHandler } = require('./commands');

class DecompileCtrl {

    constructor() {
        this.memFs = new DecompileMemFsProvider();
        this.memFsFromFileSystem = memFsFromFileSystem;
        this.commandHandler = new CommandHandler(this);
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
        let ext = path.extname(uri.fsPath);

        let tool = this.commandHandler.cmdForFileExtension[ext];
        if (tool) {
            return tool.decompile(uri, progressCallback, token);
        }
        //try default
        tool = this.commandHandler.cmdForFileExtension['*'];
        if (tool) {
            return tool.decompile(uri, progressCallback, token);
        }
        vscode.window.showErrorMessage(`I'm sorry, I don't know how to decompile file ${ext} :/`);
    }

    reveal() {
        return vscode.workspace.updateWorkspaceFolders(0, 0, { uri: vscode.Uri.parse("decompileFs:/"), name: "🔍Decompiler!" });
    }

}

module.exports = {
    DecompileCtrl: DecompileCtrl
};