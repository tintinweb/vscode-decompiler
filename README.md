[<img width="200" alt="get in touch with Consensys Diligence" src="https://user-images.githubusercontent.com/2865694/56826101-91dcf380-685b-11e9-937c-af49c2510aa0.png">](https://diligence.consensys.net)<br/>
<sup>
[[  🌐  ](https://diligence.consensys.net)  [  📩  ](mailto:diligence@consensys.net)  [  🔥  ](https://consensys.github.io/diligence/)]
</sup><br/><br/>


# VSCode Decompiler!

Let's be honest, there is no reason to remember how to decompile stuff with the various tools available. Wouldn't it be nice to be able to decompile the $h*! out of things right off the fingertips in visual studio code? Well, here we go. 

This extension can be used to decompile ...

* <img width="17" alt="Screenshot 2020-05-13 at 14 11 53" src="https://user-images.githubusercontent.com/2865694/81810700-b7e73b80-9523-11ea-9ed3-f52704689939.png"> Binary executables for various platforms (as supported by Ghidra; Windows PE, Linux ELF, etc..)
* <img width="16" alt="Screenshot 2020-05-13 at 14 10 09" src="https://user-images.githubusercontent.com/2865694/81810613-8a9a8d80-9523-11ea-9fd9-0c83274746d7.png"> Java Jar archives and compiled Classes
* <img width="15" alt="Screenshot 2020-05-13 at 14 09 49" src="https://user-images.githubusercontent.com/2865694/81810616-8c645100-9523-11ea-9bd1-cfddde16a420.png"> Android APKs


![vscode-decompiler](https://user-images.githubusercontent.com/2865694/81797377-faeae400-950e-11ea-9060-2712dbb4740f.gif)

Just `right-click → Decompile` on a supported executable and wait for the magic to happen.

The decompilation result is added to a temporary sub-workspace. You can `right-click → Download` files to your local file-system right from the sub-workspace.

Have phun 🙌


## Setup

* Requires Java (11+) to be installed system-wide. Just install the latest JRE/JDK for your OS (e.g. openJDK).
* Requires a working installation of [Ghidra](https://ghidra-sre.org/) (← Download)
  * either available in `PATH` (like when you installe it with with `brew cask install ghidra` on os-x; or set-up manually)
  * otherwise please specify the path to the executable `<ghidra>/support/analyzeHeadless` in `code → preferences → settings: vscode-decompiler.tool.ghidra.path` and make sure that the `analyzeHeadless` script runs without errors (and is not prompting for the JDK Home 🤓). Here's a sample Ghidra config for Windows:
  ![ghidraconf](https://user-images.githubusercontent.com/2865694/81807509-7dc76b00-951e-11ea-99d7-359bd624cce5.png)

* Other tools are bundled with the extension. Just make sure Java is available in your `PATH`.

## Credits

This extension wouldn't be possible without the smarties that are developing the following reverse-engineering tools: 

* [Ghidra](https://github.com/NationalSecurityAgency/ghidra/)
* [JadX](https://github.com/skylot/jadx/)
* [JD-CLI](https://github.com/kwart/jd-cmd)
* [dex2Jar](https://github.com/pxb1988/dex2jar)
* LogoMakr (CC; Logo)

## Release Notes

see [CHANGELOG](./CHANGELOG.md)


-----------------------------------------------------------------------------------------------------------
