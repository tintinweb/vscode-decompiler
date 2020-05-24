# Change Log

## 0.0.6
- new: added support for decompiling Python `.pyc` and `.pyo`
- new: (windows) added support for legacy ida pro decompiler via hexx plugin (slow)
- fixed: (windows) generator tag indentation for idapro
- fixed: (windows) spaces in toolpath break invocation of decompiler
- fixed: (windows) mixed line-endings when decompiling with ghidra on windows
- fixed: cancel button has no effect (partially fixed as we do not killtree the proc)
- changed: disable readonly for decompiled source files


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
