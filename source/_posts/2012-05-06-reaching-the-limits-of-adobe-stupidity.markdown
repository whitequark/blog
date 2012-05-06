---
layout: post
title: "Reaching the Limits of Adobe Stupidity"
date: 2012-05-06 18:08
comments: true
categories:
 - software
 - wtf
---

Lately, I've been working on Flash ActionScript 3 decompiler, and I noticed an interesting pattern. Normally, if you work with a piece of well-known software and something goes wrong, it's your fault. But with Flash it's not anything like that! If it doesn't work, then it's probably a bug in the compiler which was preserved for compatibility. Or the specification is plain wrong. Or it's a bug in the compiler which no one noticed or attributed to cosmic rays instead.

I'll give a few examples.
<!--more-->
Specification is wrong
----------------------

The [official specification][] on AVM2 is often plain incorrect. Apart from examples already covered in semi-official Mozilla-authored [errata][], there are a few *subtle mistakes*. Like mixing up *sign bit* and *sign extension*: section 4.1 of spec mentions that signed integers are stored with sign extension, whereas in reality they're stored with 31th bit set when the values are negative.

There are some other ones (e.g. pushliteral opcodes are [screwed up][] in spec), but they're not worth explaining.

  [official specification]: http://www.adobe.com/content/dam/Adobe/en/devnet/actionscript/articles/avm2overview.pdf
  [errata]: https://wiki.mozilla.org/Tamarin::AVM2_Overview_Errata
  [screwed up]: https://github.com/whitequark/furnace-avm2/commit/9e6f833cd8231385dc95e3ae54cbedcdb4143791

Compiler generates dangerously invalid code
-------------------------------------------

When working on support for `lookupswitch` opcode I wrote a small snippet to test my code with. Disassembling it yielded strange results; the code was seemingly invalid. I scratched my head on it for half a hour and then just went and tried to execute it. And you know what? It actually **was** invalid.

{% codeblock lang:actionscript %}
function propel_switch(q:int):Boolean {
  switch(q) {
  case 1:
    print("hoge");
  break;
  case 2:
    print("fuga");
  break;
  case 3:
    print("piyo");
  break;
  case 5:
    print("bar");
  break;
  default:
    print("baz");
  break;
  }
  return false;
}

//                   expected   actual
propel_switch(0); // baz        baz
propel_switch(1); // hoge       hoge
propel_switch(2); // fuga       fuga
propel_switch(3); // piyo       <nothing printed>
propel_switch(4); // baz        <infinite loop>
propel_switch(5); // bar        bar
{% endcodeblock %}

(The "actual" results are derived from assembler listings. Tamarin shell refused to execute it due to verification errors.)

No optimization ever
--------------------

ActionScript compiler does not optimize, period. This produces a lot of weird code and some pieces of modern art.

Consider this `switch` statement (taken from [abcdump.as] utility):

{% codeblock lang:actionscript %}
 switch (version) {
 case 46<<16|14:
 case 46<<16|15:
 case 46<<16|16:
     var abc:Abc = new Abc(data)
     abc.dump()
     break
 case 67|87<<8|83<<16|10<<24: // SWC10
 case 67|87<<8|83<<16|9<<24: // SWC9
 case 67|87<<8|83<<16|8<<24: // SWC8
 case 67|87<<8|83<<16|7<<24: // SWC7
 case 67|87<<8|83<<16|6<<24: // SWC6
     var udata:ByteArray = new ByteArray
     udata.endian = "littleEndian"
     data.position = 8
     data.readBytes(udata,0,data.length-data.position)
     var csize:int = udata.length
     udata.uncompress()
     infoPrint("decompressed swf "+csize+" -> "+udata.length)
     udata.position = 0
     /*var swf:Swf =*/ new Swf(udata)
     break
 case 70|87<<8|83<<16|10<<24: // SWF10
 case 70|87<<8|83<<16|9<<24: // SWF9
 case 70|87<<8|83<<16|8<<24: // SWF8
 case 70|87<<8|83<<16|7<<24: // SWF7
 case 70|87<<8|83<<16|6<<24: // SWF6
 case 70|87<<8|83<<16|5<<24: // SWF5
 case 70|87<<8|83<<16|4<<24: // SWF4
     data.position = 8 // skip header and length
     /*var swf:Swf =*/ new Swf(data)
     break
 default:
     print('unknown format '+version)
     break
 }
{% endcodeblock %}

Not only it generates [a piece of modern art](https://gist.github.com/2622705) in an <abbr title="Internal Representation">IR</abbr> dump, but also has a statement so beautifully useless it should be preserved for future generations:

{% codeblock lang:scheme %}
  (ternary (false) (integer 15) (integer 15))
{% endcodeblock %}

For those unaware of [s-expressions][] and Lisp, not only does this conditional always execute the same branch, but its result also wouldn't be different even if other one would be taken.

For extra horror, the "piece of modern art" above is executed from scratch _each time the VM encounters it_, including the constant expressions. Any doubt left why Flash is so slow and power-hungry?

  [abcdump.as]: http://hg.mozilla.org/tamarin-redux/file/b7e3811ee1ae/utils/abcdump.as#1267
  [s-expressions]: https://en.wikipedia.org/wiki/S-expression

Compiler intentionally generates invalid code
---------------------------------------------

As I've already shown, <abbr title="ActionScript compiler">ASC</abbr> contains enough stupid errors (see this similar [bug][]) to accidentally generate invalid code in not-so-rare cases. But it also intentionally generates invalid code in one very frequent case: a `finally` block.

Let's compile this function:

{% codeblock lang:actionscript %}
    function c() {
      try {
        hoge();
      } finally {
        piyo();
      }
    }
{% endcodeblock %}

The compiler will emit a shitload of bytecode (including _two_ catch and _two_ throw statements), but the relevant part is here:

{% codeblock %}
; This is an exception handler. Stack is empty upon jump to an
; exception handler.
;  Address          Opcode    Args   Stack state, comments
   0016             GetLocal0        ; [local0]
   0017             PushScope        ; []
   0018             GetLocal1        ; [local1]
   0019             PushScope        ; []
   0020              NewCatch        ; [catch]
   0022                   Dup        ; [catch catch_dup]
   0023             SetLocal2        ; [catch]
   0024             PushScope        ; []
   0025                 Throw        ; I want an object to throw! Ouch!
   0026              PopScope
   0027                  Kill     2
   0029              PushByte    -1
   0031                  Jump   +32  ; Jump to rethrow
{% endcodeblock %}

As you see, the opcode at addresses 0025 is invalid because it tries to pop an object from an empty stack. The virtual machine actually recognizes the `finally` clause _by encountering these invalid opcodes_. Think about it a little longer, and you'll go insane.

Also, the _recommended_ way to flow control after a `finally` statement is... using `lookupswitch` opcode. The `PushByte -1` is actually a mark for that `lookupswitch` trampoline which makes it jump to a rethrow entry point.

There's some more interesting stuff like [jumps past the end of function][jumps] (hardwired in VM to do the same as `returnvoid` opcode) or deliberately emitted dead code.

  [bug]: http://bugs.adobe.com/jira/browse/ASC-74
  [jumps]: http://stackoverflow.com/questions/8841456/why-does-the-flash-actionscript3-compiler-emit-unnecessary-code