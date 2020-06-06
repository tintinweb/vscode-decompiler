'use strict';
/** 
 * @author github.com/tintinweb
 * @license MIT
 * 
 * 
 * */

const { DefaultCmd } = require('./commands/default');
const { JavaCmd } = require('./commands/java');
const { AndroidCmd } = require('./commands/android');
const { PythonCmd } = require('./commands/python');

class CommandHandler {

    constructor(ctrl) {
        this.cmds = [
            new DefaultCmd(ctrl),
            new JavaCmd(ctrl),
            new AndroidCmd(ctrl),
            new PythonCmd(ctrl)
        ];
        this.cmdForFileExtension = {};

        // build file-extension -> cmdlet mapping
        this.cmds.forEach(
            cmd => cmd.getSupportedFileExtensions().forEach(function(ext){
                if(this.cmdForFileExtension[ext]){
                    throw Error("Handler for File-Extension already registered");
                }
                this.cmdForFileExtension[ext]=cmd;
            }, this)
        );
    }

}

module.exports = {
    CommandHandler: CommandHandler
};