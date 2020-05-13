[<img width="200" alt="get in touch with Consensys Diligence" src="https://user-images.githubusercontent.com/2865694/56826101-91dcf380-685b-11e9-937c-af49c2510aa0.png">](https://diligence.consensys.net)<br/>
<sup>
[[  🌐  ](https://diligence.consensys.net)  [  📩  ](mailto:diligence@consensys.net)  [  🔥  ](https://consensys.github.io/diligence/)]
</sup><br/><br/>


# VSCode Decompiler!

Let's be honest, there is no reason to remember how to decompile stuff with the various tools available. Wouldn't it be nice to be able to decompile the $h*! out of things right off the fingertips in visual studio code? Well, here we go. 

This extension decompiles the $h*! out of ...

* Binaries supported by Ghidra (windows PE, linux ELF, etc)
* Java jars and classes
* Android APKs

![vscode-decompiler](https://user-images.githubusercontent.com/2865694/81797377-faeae400-950e-11ea-9060-2712dbb4740f.gif)

Just `right-click → Decompile` on any of the supported file formats and wait for the magic to happen.

Decompiled files are added to a temporary sub-workspace, just `right-click → Download` in the sub-workspace to save the decompiled files.


## Setup

* Requires Java (11+) to be installed system-wide. Just install the latest JRE/JDK for your OS (e.g. openJDK).
* Requires a working installation of [Ghidra](https://ghidra-sre.org/)
  * either available in `PATH` (e.g. because you installed with with `brew cask install ghidra`)
  * otherwise please specify the path to `<ghidra>/support/analyzeHeadless` in `code → preferences → settings: vscode-decompiler.tool.ghidra.path` and make sure that the `analyzeHeadless` script works (and is not prompting for e.g. the JDK Home :))
  ![ghidraconf](https://user-images.githubusercontent.com/2865694/81807509-7dc76b00-951e-11ea-99d7-359bd624cce5.png)

* The other - way smaller - tools are bundled with the extension. Just make sure Java is available in your `PATH`.

## Credits

This extension wouldn't be possible without the smarties developing the following software: 

* [Ghidra](https://github.com/NationalSecurityAgency/ghidra/)
* [JadX](https://github.com/skylot/jadx/)
* [JD-CLI](https://github.com/kwart/jd-cmd)
* [dex2Jar](https://github.com/pxb1988/dex2jar)
* Logo by LogoMakr (CC)

## Release Notes

see [CHANGELOG](./CHANGELOG.md)


-----------------------------------------------------------------------------------------------------------
