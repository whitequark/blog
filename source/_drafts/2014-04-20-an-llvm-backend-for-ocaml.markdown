---
layout: post
title: "An LLVM backend for OCaml"
date: 2014-04-20 16:21
comments: true
categories:
  - software
  - ocaml
---

While exploring OCaml's sources for my [article on extension points][], I started wondering
how hard would it be to write a practical LLVM backend for OCaml. I've implemented
an experimental translator from one of OCaml's intermediate representations, Cmm, to LLVM IR.
In this article I'll share my experience.

<!--more-->

Benefits from LLVM
------------------

Before we start, it's worthwhile to discuss which benefits a working LLVM backend would
bring us.

...

Prior work
----------

There have been two attempts to implement an LLVM backend to OCaml already, Colin Benner's
[OCaml-LLVM][] and Raphael Amiard's [CamllVM][]. Neither attempt has been successful;
nevertheless, it's possible to gain insight from their work.

[ocaml-llvm]: https://github.com/colinbenner/ocamlllvm
[camllvm]:    https://github.com/raph-amiard/CamllVM

### OCaml-LLVM

OCaml-LLVM was developed as an alternative backend to the official OCaml compiler. It accepted
the Cmm IR (the last machine-independent IR) and emitted LLVM IR assembly, just like
the machine code backends. Later, two more intermediate representations before the LLVM IR
were added, because direct translation was too complex.

### CamllVM

CamllVM was developed as a separate translator from OCaml bytecode to LLVM IR assembly.
It is written in C++. The generated code performs significantly worse than code emitted
by ocamlopt.

### Lessons from OCaml-LLVM and CamllVM

The part that caught my attention in OCaml-LLVM was that it generates LLVM IR essentially
by concatenating strings. Unlike regular assembly, however, LLVM IR is strictly typed
and is very verbose, which means that generating it is hard. The two additional
representations introduced solely to make generating LLVM IR easier demonstrate this
problem.

In my code, I have used the OCaml bindings, which have been a part of LLVM for about
9 years at this point. The code for the translator is quite compact and straightforward.

CamllVM uses bytecode as input, rather than reusing ocamlopt's machinery. On one hand,
this means that CamllVM is more resilient to changes in the official OCaml distribution.
On the other hand, this choice forces CamllVM to implement its own ABI, replicating
a lot of work and possibly becoming out of sync with the C extensions, which track
the official compiler.

I chose to reuse ocamlopt's logic for such tasks as performing arithmetics on tagged
integers, lowering object-oriented code, and so on.
