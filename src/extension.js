'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */

/** imports */
const vscode = require("vscode");
const settings = require('./settings');
const { DecompileCtrl } = require('./features/decompile');

function vscodeShowSingleFile(options, where) {
    return vscode.workspace.openTextDocument(options).then(doc => {
        return vscode.window.showTextDocument(doc, where || vscode.ViewColumn.Active);
    });
}

/** event funcs */
function onActivate(context) {
    const decompileCtrl = new DecompileCtrl();
    
    context.subscriptions.push(
        vscode.workspace.registerFileSystemProvider(
            'decompileFs',
            decompileCtrl.memFs,
            {
                isCaseSensitive: true,
                isReadonly: true
            }
        )
    );

    
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(e => {
        })
    );
    

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'vscode-decompiler.decompile',
            (uri) => {
                if(!vscode.workspace.getWorkspaceFolder(vscode.Uri.parse("decompileFs:/"))){
                    console.log("isNotInitialized");
                    context.workspaceState.update("vscodeDecompiler.pendingUri", `${uri};${Date.now()}`).then(() => {
                        console.log(context.workspaceState.get("vscodeDecompiler.pendingUri", null));
                        console.log("wait for reload...");
                        decompileCtrl.reveal();
                    });
                    return;
                }
                
                decompileCtrl.showDecompileWithProgress(uri).then(ret => {
                    if (ret.type == "single") {
                        vscodeShowSingleFile(vscode.Uri.parse(ret.memFsPath))
                        .then(
                            result => {}, 
                            error => {
                                vscodeShowSingleFile({content: ret.data, language: ret.language});  //if this fails, show directly as new file
                            })
                        .catch(() => {
                            vscodeShowSingleFile({content: ret.data, language: ret.language});  //if this fails, show directly as new file
                        });

                    } else if (ret.type == "multi") {
                        decompileCtrl.reveal(); //reveal memfs with contents
                    } else {
                        vscode.window.showErrorMessage("Failed to decompile file :/");
                    }
                });
            }
        )
    );


    const pendingUriTs = context.workspaceState.get("vscodeDecompiler.pendingUri", null);
    if(pendingUriTs && pendingUriTs.length && `${pendingUriTs}`.includes(";")){
        let [pendingUri, timestamp] = pendingUriTs.split(";");
        context.workspaceState.update("vscodeDecompiler.pendingUri", "").then(() => {
            if(Date.now() - parseInt(timestamp) <= 30 * 1000){
                // 30sec grace period. ignore all other pendingUris
                vscode.commands.executeCommand("vscode-decompiler.decompile", vscode.Uri.parse(pendingUri));
            }
        });
    }
}

/* exports */
exports.activate = onActivate;