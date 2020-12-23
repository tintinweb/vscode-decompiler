'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

class BaseCommand {

    constructor(ctrl) {
        this.ctrl = ctrl;
    }

    getSupportedFileExtensions() {
        throw Error("not implemented");
    }

    decompile(uri, progressCallback, token) {
        throw Error("not implemented");
    }

    static _exec(command, args, options) {
        /** windows bugfix #6 - spaces in path */
        if (!options.cwd && process.platform.startsWith("win")) {
            // node childprocess on windows is a mess. executing .bat files auto-spawns a shell and messes up args provided in the array?!
            // therefore we cwd to the toolpath first and exec the command from there. 
            // note: spawns shell -> insecure.
            if (command.includes(" ") && fs.existsSync(command)) {
                //space in path & realpath -> cwd to command and just call it from there..
                options.cwd = path.dirname(command);
                command = path.basename(command);
            }
        }
        //console.log(command + " " + args.join(" "));
        /** /windows bugfix #6 */
        const cmd = spawn(command, args, {
            stdio: options.stdio || ['ignore', options.onStdOut ? 'pipe' : 'ignore', options.onStdErr ? 'pipe' : 'ignore'],
            shell: options.shell,
            cwd: options.cwd
        });
        if (options.onClose) {
            cmd.on('close', options.onClose);
            cmd.on('error', options.onClose);
        }
        if (options.onStdOut) cmd.stdout.on('data', options.onStdOut);
        if (options.onStdErr) cmd.stderr.on('data', options.onStdErr);

        return cmd;
    }
}

module.exports = {
    BaseCommand: BaseCommand
};