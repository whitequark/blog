---
layout: post
title: "Towards Rust on bare metal"
date: 2014-01-04 11:46
comments: true
categories:
  - software
  - rust
  - rust-micro
---

I have [long dreamed][lang-for-embedded] for a safe, modern, high-level language suitable for
embedded development. I even took a shot at it myself, but it [didn't quite work out][foundry-cancel].
At about the same time, I discovered that through its long and fascinating history of redesigns,
[Rust][rust] became a nearly perfect match for that goal.

[lang-for-embedded]: http://localhost:4000/blog/2012/12/06/a-language-for-embedded-developers/
[foundry-cancel]: http://localhost:4000/blog/2013/12/21/foundry-has-been-cancelled/
[rust]: http://rust-lang.org

Rust provides out of the box several undeniably essential features (concurrency primitives, I/O,
stack unwinding, and others) which are dependent on the OS support. Fortunately, Rust is very
loosely coupled with its standard library and runtime, enabling one to implement a freestanding
environment.

I'm currently writing one (called [rust-micro][]) together a series of articles along with it,
documenting how one could implement a Rust runtime and an RTOS inside it, using an ARM Cortex-M3
based [STM32F103][] as an example.

[rust-micro]: http://github.com/whitequark/rust-micro
[stm32f103]: http://www.st.com/web/catalog/mmc/FM141/SC1169/SS1031/LN1565

<!--more-->

## Compiling and linking

The very first problem one would struggle with is: "how do I build a binary"? Indeed, Rust currently
knows nothing about bare-metal targets; by default, it would attempt to link the executable
dynamically, require exception handling support, enable LLVM's [segmented stack][split-stack]
support and link the C standard library through libstd. We can afford none of that.

[split-stack]: http://llvm.org/docs/SegmentedStacks.html

### Exception handling

Rust's usage of [exception handling][ehabi] is quite unusual. It only raises exceptions in three places
([1][raise-1], [2][raise-2], [3][raise-3]) and catches in [one][catch]; [landing pads][landing-pad]
inserted elsewhere in the code either invoke destructors or are used in [finally][] blocks.

This means we can just strip the exception handling code with relatively little damage to language
semantics. Rustc has a flag to do exactly that: `-Z no-landing-pads`. Of course, we would need to
change the standard library accordingly; more on that later.

[ehabi]: http://mentorembedded.github.io/cxx-abi/abi-eh.html
[raise-1]: https://github.com/mozilla/rust/blob/46412876/src/libsyntax/ext/expand.rs#L702
[raise-2]: https://github.com/mozilla/rust/blob/46412876/src/libstd/unstable/lang.rs#L20
[raise-3]: https://github.com/mozilla/rust/blob/46412876/src/libstd/rt/borrowck.rs
[catch]: https://github.com/mozilla/rust/blob/46412876/src/libstd/rt/task.rs#L105
[landing-pad]: http://mentorembedded.github.io/cxx-abi/abi-eh.html#defs
[finally]: https://github.com/mozilla/rust/blob/46412876/src/libstd/unstable/finally.rs

### Code generation

Unfortunately, support for segmented stacks in rustc is currently hardcoded, so we need
a workaround. The easiest one is to use `--emit-llvm` flag, and then use [llc][] to generate object
files ourselves. However, that method doesn't allow for linking with Rust libraries, because Rust
cannot extract its metadata from LLVM bitcode files.

A better way to get the LLVM IR out of rustc is to build all libraries statically with the `--rlib`
flag, and then build the final executable with `-Z lto --emit-llvm`. The result is a nice
self-contained LLVM bitcode file which includes all Rust dependencies, e.g. standard library.

This also allows us to easily inject CPU-specific startup code and freely specify the linking
options, circumventing lack of support for ARM Thumb ISA in rustc.

{% inset Detecting stack overflows %}
<p>You may know that split stack support was removed from Rust. Then, why does it still require
segmented stacks from LLVM and links with <code>__morestack</code>?</p>

The answer is simple: rustc abuses LLVM's segmented stacks to
<a href="https://github.com/mozilla/rust/blob/46412876/src/libstd/unstable/stack.rs#L29">abort</a>
on stack overflow. I wish I could provide the same, but LLVM's support hinges on
<a href="https://github.com/luqmana/llvm/blob/8841dce/lib/Target/ARM/ARMFrameLowering.cpp#L1574">several hardcoded methods</a> to get the stack limit, neither of which would work on our platform.
{% endinset %}

[llc]: http://llvm.org/docs/CommandGuide/llc.html

### Linking

Linking can be highly system-dependent, but our platform is nice in that it uses a very simple and
common scheme. I'll give a quick recap on the job of a linker.

On a highest level, linkers deal with _symbols_, _relocations_ and _sections_. A symbol roughly
corresponds to an entity emitted by a compiler--a function, a global variable or a constant.
Relocations allow the contents of a symbol to contain a reference to another symbol by specifying
how exactly should the linker insert the address of the referenced symbol into the referencing one.
Symbols with similar attributes are grouped into sections.

A linker turns several object files into one object file by combining sections and resolving
relocations, that is, performing the computation specified by relocation and embedding the result
into containing symbol.

{% inset Linkers! %}
If you want to know more about linkers, I recommend to read an excellent
<a href="http://www.airs.com/blog/page/5?s=linkers">series of articles</a> by Ian Lance Taylor,
the author of <a href="http://en.wikipedia.org/wiki/Gold_(linker)">gold</a>, or much shorter
<a href="http://lld.llvm.org/design.html">design notes</a> of LLVM's linker, lld.
{% endinset %}

We'll mainly deal with a few sections:

  * `.text`, containing machine code (`fn text_sym() {}` in Rust),
  * `.rodata`, containing constant data (`static rodata_sym: int = 1` in Rust),
  * `.data`, containing initialized data (`static mut data_sym: int = 1` in Rust),
  * `.bss`, containing zeroed-out data (`static mut bss_sym: int = 0` in Rust).

Unlike x86 with virtual memory, which allows the executable to be placed almost arbitrarily in the
address space, our STM32F103 target requires everything to be placed according to
a [memory map][stm32f103-mmap]. In particular, it allows direct access to read-only data stored
in Flash memory, mapped to `0x08000000`, in addition to regular RAM mapped to `0x20000000`.

Efficient use of resources would require arranging sections in a very particular way:

  * `.text` and `.rodata` must be placed in Flash ROM,
  * `.data` must also be placed in RAM, but its initial content must appear in ROM,
  * `.bss` must be placed in RAM.

We can communicate this information with a [linker script][ldscript]; rust-micro includes
[elf32-littlearm.ld][], which specifies the section placement, and a bunch of device-specific ones,
e.g. [maple-leaf.ld][], which defines memory mapping.

...

[stm32f103-mmap]: /images/towards-rust-on-bare-metal/stm32f103-mmap.png
[ldscript]: https://sourceware.org/binutils/docs/ld/Scripts.html
[elf32-littlearm.ld]: https://github.com/whitequark/rust-micro/blob/master/lib/scripts/elf32-littlearm.ld
[maple-leaf.ld]: https://github.com/whitequark/rust-micro/blob/master/lib/scripts/maple-leaf.ld

### Startup code

### Interrupt handling

## Standard library

### Heap

### Peripheral access

## To be continued
