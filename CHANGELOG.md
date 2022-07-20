# Change Log

## 0.1.0
- new: better error reporting. if the extension fails to decompile a target it will now show an output with the stderr of the external tool in the vscode/output view.

<img width="705" alt="image" src="https://user-images.githubusercontent.com/2865694/179998678-4eaca055-1be8-4c19-b850-1c1caf3c3fb3.png">

- fix: ghidra decompile script exception handling. the script now continues if ghidra is unable to decompile certain functions.
- updated: jadx to [1.4.2](https://github.com/skylot/jadx/releases/tag/v1.4.2)
- updated: jd-cli to [1.2.1](https://github.com/intoolswetrust/jd-cli/releases/tag/jd-cli-1.2.1)
- updated: Readme reference to brew cask command to the newer --cask syntax #17 - thanks @demns


## 0.0.8
- fix: ghidra compatibility issues #15

## 0.0.7
- new: added support for decompiling Ethereum EVM byte-code
- new: command `vscode-decompiler.decompileShowContent` that takes file content instead of file paths.
- maintenance: refactored codebase

## 0.0.6
- new: added support for decompiling Python `.pyc` and `.pyo`
- new: (windows) added support for legacy ida pro decompiler via hexx plugin (ida <= 6.6)
- fix: (windows) generator tag indentation for idapro
- fix: (windows) spaces in toolpath break invocation of decompiler
- fix: (windows) mixed line-endings when decompiling with ghidra on windows
- fix: cancel button has no effect (only partially fixed, we do not killtree the proc)
- updated: disable readonly mode for decompiled files


## 0.0.5
- fix: ignore corrupt workspace-state
  - when we load the sub-workspace vscode forcefully reloads the extension. To avoid any inconvenience e.g. because calling "decompile" appears to have no action we replay that command once we're reloaded. that command is stored in the workspace for 30secs (file to be decompiled on reload).
  - in case the workspace state is corrupt the extension would permanently throw. this changeset is adding safeguards to avoid that the extension cannot be used anymore because of a corrupt workspace state.

## 0.0.4
- new: multi-select decompilation
  - select multiple items and click `decompile` to decompile them in parallel
  - hint: don't select too many binaries at once :D

## 0.0.3
- updated: Readme / Screenshots

## 0.0.2
- new: add experimental support for IDA Pro (Windows Only)

## 0.0.1
- Initial release
