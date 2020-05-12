#!/usr/bin/env python
# -*- coding: utf-8 -*-
# Credits:  https://reverseengineering.stackexchange.com/questions/21207/use-ghidra-decompiler-with-command-line
#           modified by github.com/tintinweb
from ghidra.app.decompiler import DecompInterface
from ghidra.util.task import ConsoleTaskMonitor
import sys


class Unbuffered(object):
    def __init__(self, stream):
        self.stream = stream
    def write(self, data):
        self.stream.write(data)
        self.stream.flush()
    def writelines(self, datas):
        self.stream.writelines(datas)
        self.stream.flush()
    def __getattr__(self, attr):
        return getattr(self.stream, attr)

sys.stderr = Unbuffered(sys.stderr)

# get the current program
# here currentProgram is predefined

program = currentProgram
decompinterface = DecompInterface()
decompinterface.openProgram(program)
functions = program.getFunctionManager().getFunctions(True)
argv = getScriptArgs()

if len(argv)<=0:
    sys.stderr.write("Wrong Arguments\n")
    exit(1)


dst = str(argv[0])
l_functions = list(functions)
num_functions = len(l_functions)

with open(dst, 'w') as f:
    for nr,function in enumerate(l_functions):
        sys.stderr.write("#DECOMPILE-PROGRESS,%d,%d,%s"%(nr+1, num_functions, function))
        f.write("/* Function: %s */"%function)

        # decompile each function
        tokengrp = decompinterface.decompileFunction(function, 0, ConsoleTaskMonitor())
        
        f.write(str(tokengrp.getDecompiledFunction().getC()))
sys.stderr.write("#DECOMPILE-STATUS,ok")