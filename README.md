[<img width="200" alt="get in touch with Consensys Diligence" src="https://user-images.githubusercontent.com/2865694/56826101-91dcf380-685b-11e9-937c-af49c2510aa0.png">](https://diligence.consensys.net)
<sup></sup>
[ [🌐](https://diligence.consensys.net)  [📩](mailto:diligence@consensys.net)  [🔥](https://consensys.github.io/diligence/) ]
<br>
# Decompiler!

Let's be honest, there is no reason to remember how to decompile stuff with the various tools available. Wouldn't it be nice to just decompile the $h\*! out of things right off the fingertips in Visual Studio Code? Well, here we go:

This extension can be used to decompile ...

* <img width="17" alt="Screenshot 2020-05-13 at 14 11 53" src="https://user-images.githubusercontent.com/2865694/81810700-b7e73b80-9523-11ea-9ed3-f52704689939.png"><img width="17" alt="Screenshot 2020-05-13 at 19 26 56" src="https://user-images.githubusercontent.com/2865694/81844741-d3683b80-954f-11ea-8d21-df843d1dc4df.png"> Binary executables for various platforms
    * as supported by [Ghidra](https://github.com/NationalSecurityAgency/ghidra/wiki/Frequently-asked-questions#what-processors-are-currently-supported); Windows PE, Linux ELF, IOS, etc..
    * or [IDAPro](https://www.hex-rays.com/products/ida/processors/) (Experimental, Windows Only for now)
* <img width="16" alt="Screenshot 2020-05-13 at 14 10 09" src="https://user-images.githubusercontent.com/2865694/81810613-8a9a8d80-9523-11ea-9fd9-0c83274746d7.png"> Java Jar archives and compiled Classes
* <img width="15" alt="Screenshot 2020-05-13 at 14 09 49" src="https://user-images.githubusercontent.com/2865694/81810616-8c645100-9523-11ea-9bd1-cfddde16a420.png"> Android APK's
* <img width="15" alt="Screenshot 2020-05-13 at 14 09 49" src="https://user-images.githubusercontent.com/2865694/82730302-e7a1fa80-9cfe-11ea-9499-8cabe633a1d0.png"> Python `.pyc` and `.pyo`

Just `right-click → Decompile` on a supported executable and wait for the magic to happen.

The decompilation result is added to a temporary sub-workspace. You can `right-click → Download` files to your local file-system right from the sub-workspace.

Have phun 🙌

## Tour

**macOS**

![vscode-decompiler](https://user-images.githubusercontent.com/2865694/81797377-faeae400-950e-11ea-9060-2712dbb4740f.gif)

**Windows (Ghidra vs. IDAPro)**

![vscode-decompiler-idapro](https://user-images.githubusercontent.com/2865694/82062800-ee12ef80-96ca-11ea-8ef6-78920c012477.gif)

## Setup

<details>
  <summary style='font-size:12pt'>Requirements: General</summary>

* Requires Java (11+) to be installed system-wide. Just install the latest JRE/JDK for your OS (e.g. OpenJDK, Oracle JDK).
* Other tools are bundled with the extension. Just make sure Java is available in your `PATH`.

</details>
<details>
  <summary style='font-size:12pt'>Requirements: Binary executables (Ghidra / IDA Pro)</summary>

* Requires a working installation of [Ghidra](https://ghidra-sre.org/) (← Download) to decompile executables
    * either available in `PATH` (like when you install it with `brew cask install ghidra` on os-x; or set-up manually)
    * otherwise please specify the path to the executable `<ghidra>/support/analyzeHeadless` in `code → preferences → settings: vscode-decompiler.tool.ghidra.path` and make sure that the `analyzeHeadless` script runs without errors (and is not prompting for the JDK Home 🤓). Here's a sample Ghidra config for Windows:
    ![ghidraconf](https://user-images.githubusercontent.com/2865694/81807509-7dc76b00-951e-11ea-99d7-359bd624cce5.png)
* (Experimental; Windows Only) Optional a licensed version of [IDA Pro](https://www.hex-rays.com/products/decompiler/) with decompiler support.
    * specify the path to the `idaw` executable in `code → preferences → settings: vscode-decompiler.tool.idaPro.path`, e.g. `c:\IDA68\idaw.exe`.
    * set preference to `idaPro (experimental Windows Only)` in `code → preferences → settings: vscode-decompiler.default.decompiler.selected`.
    * we'll automatically try to run 32 and 64bits `idaw` on the target application (preference on what executable is configured by you)
    * If you're running `<= IDA Pro 6.6` and the normal IDA decompilation mode does not work you can try the set preference to `idaPro legacy hexx-plugin (experimental Windows Only)` in `code → preferences → settings: vscode-decompiler.default.decompiler.selected`. Note: Use this method only if the normal IDA Pro mode doesnt work. Caveat: `idaw*.exe` must not be in a path that contains spaces, ask @microsoft why 😉.

</details>
<details>
  <summary style='font-size:12pt'>Requirements: Python</summary>

* Python decompilation requires `pip3 install uncompyle6` (see settings)

</details>

<details>
  <summary style='font-size:12pt'>Setting tool preferences</summary>

`code → preferences → settings:`

* Set default decompiler preference to `ghidra` (default) or `idaPro (experimental Windows Only)` (requires a licensed version of IDAPro + Decompiler)
    * `vscode-decompiler.default.decompiler.selected`
* Set preference for java decompilation to JADX or JD-CLI (default)
    * `vscode-decompiler.java.decompiler.selected`
* Set preference for android apk decompilation to dex2jar + jd-cli (slow) or JADx (default)
    * `vscode-decompiler.apk.decompiler.selected"`

</details>

## Credits

This extension wouldn't be possible without the smarties that are developing the following reverse-engineering tools:

* [Ghidra](https://github.com/NationalSecurityAgency/ghidra/)
* [JadX](https://github.com/skylot/jadx/)
* [JD-CLI](https://github.com/kwart/jd-cmd)
* [dex2Jar](https://github.com/pxb1988/dex2jar)
* [IDA Pro Advanced & Decompiler](https://www.hex-rays.com/products/decompiler/)
* [python-uncompyle6](https://github.com/rocky/python-uncompyle6/)
* LogoMakr (CC; Logo)

## Release Notes

see [CHANGELOG](./CHANGELOG.md)

- - -

<br>
<br>
