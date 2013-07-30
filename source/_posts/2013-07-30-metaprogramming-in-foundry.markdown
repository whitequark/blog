---
layout: post
title: "Metaprogramming in Foundry"
date: 2013-07-30 05:58
comments: true
categories:
  - foundry
  - software
---

The language I'm working on, [Foundry][fy], is developed as a practical
alternative to widely used systems programming languages, in particular
C, C++ and variants of Java. As such, it is statically typed, can elegantly
expose machine-specific details when required, and is tuned to provide
predictable and efficient (in that order) space and time behavior.

  [fy]: http://whitequark.org/blog/2012/12/06/a-language-for-embedded-developers/

In this article, I present a way to add dynamic, Ruby-style metaprogramming
facilities to a statically compiled language with an ML-derived type system.

<!--more-->

Prior art
---------

Some definitions I will be using:

 * Metaprogramming: any programmatical interaction with the compile-time
   or runtime entities which usualy arise from special syntactic forms in
   the language.
 * Macro: an entity (which may or may not have Turing completeness)
   which manipulates syntactic structure of some target program; usually
   performs syntactic expansion.

So, how are macros typically used for metaprogramming? I should note that
my findings mainly apply to languages with non-extensible syntax, such as
C, C++ and Java; however, I can observe that even languages with extensible
syntax (e.g. Rust) and proper hygienic macros can use them mainly for
metaprogramming. In fact, all [examples](rust-macros) given in the Rust
documentation for its macro system are, in essence, metaprogramming.

  [examples]: http://static.rust-lang.org/doc/tutorial-macros.html

I will feature several examples extracted from the C and C++ code I used to
work with.

  * C provides a facility for defining type aliases (typedef), but these
    aliases cannot be defined conditionally (e.g. depending on the word
    width of the host environment). C++ template system allows to define
    types conditionally in some restricted cases (including the previous
    example), but in order for this to work, certain terms must be explicitly
    supported by the compiler.

    In general case, such expansions must be performed by the C preprocessor,
    which is not hygienic (or aware of syntax) or Turing-complete, limiting
    its usefulness.

  * AVR-libc provides a function [delay_ms][], which performs busy waiting on
    a CPU core. This function relies not just on the C preprocessor, but also
    on constant propagation pass in the compiler to compute the loop count;
    if the code is compiled with -O0, this abstraction breaks, and not only
    the delay_ms function will not work, but the code will suddenly require
    to be linked with libm (sic), a software floating point implementation.

  * FSM generators such as lex, yacc, or ragel are immensely useful; however,
    these tools rely on code generation. Not only this mixes private context
    of the generated FSM and user-supplied code, but also these tools must
    perform limited lexical analysis of the user-supplied callbacks in order
    to pass collected data.

    The way such tools accept user-supplied expressions can also be problematic.
    For example, Ragel documentation specifies that the user must supply a code
    fragment to return a "current" character from a string, and such fragment
    must execute quickly and without side effects, because the generated code may
    call it (i.e. embed it in the generated code) multiple times in an unspecified way.

  [delay_ms]: http://www.nongnu.org/avr-libc/user-manual/group__util__delay.html

At last, there only exist rudimentary facilities to enhance debuggability of
the generated code (often, it is just `#line`.) This particular problem also
manifests itself in more advanced languages; OCaml code often relies on
preprocessors, and Lisp has true macros. The clang compiler employs complex
and costly techniques which allow it to explain syntax or semantic errors
happening in macros by expanding or contracting the original form by an
arbitrary number of iterations; I'm not aware of any Lisp implementations with
the same kind of facility. (I'm not sure if it is possible at all.)

What is similar in all of these examples? One can notice that in all three cases,
syntax does not matter, only the end result does: declaration of a type with
a certain name; a computation; definition of an algorithm. (It does not matter
that e.g. a Bison-generated parser is also written in C; it could as well output
code in FORTRAN and wrap user-specified actions in C procedures.)

This is what I call "metaprogramming": essentially, populating language-internal
(i.e. compiler-internal or runtime-internal) structures, such as constant, method
or type tables, or compiler IR, or bytecode, with results of arbitrary computations.

It can also be observed that languages where the only way to perform metaprogramming
is to let compiler interpret generated syntax, internal preprocessors tend to
become Turing-complete, often with great difficulties and without regard to their
original function. Both C preprocessor and C++ template system are almost Turing-
complete; CPP must be repeatedly invoked with its own input, and template resolver
is forced to halt after a certain number of steps in practice.

The meta-language
-----------------

I interpret all of the above as a cue to language design, and present my solution,
which is much more elegant.

To address metaprogramming, Foundry implements a meta-language. Foundry is first and
foremost object-oriented; all values are objects. Semantically, the only way to
interact with an object is to send it messages; only the object may alter or inspect
its internal state. All objects have classes, and classes are objects, too.
(Foundry's object model is obviously based on Smalltalk.)

Foundry implements a simple static type system with parametric types and type
inference. Both classes and their methods can have polytypes; however, all polytypes
must be resolved to monotypes according to their usage. All object state must
be explicitly typed; possibly by using type variables of its class.
(Foundry's type system is obviously based on ML.)

However, every single action which is representable in syntax can also be done with
a message sent to some object. For example, a syntax which defines a method, i.e.
{% codeblock lang:ruby %}
def print(stream) : Stream -> nil
  stream.puts('aww')
end
{% endcodeblock %}
and is placed in a class definition is entirely equivalent to the following code,
which sends a message to the class object and attaches the method body in a closure:
{% codeblock lang:ruby %}
Cat.define_method(:print) do |stream| : (Stream) -> nil
  stream.puts('aww')
end
{% endcodeblock %}
In a similar way new variables can be defined or queried, and so on.

In other words, Foundry inverts the usual relationship between syntax and semantics.
Instead of placing syntax before everything else and performing metaprogramming
by generating syntax, which is then translated to actions on the language-internal
data structures, Foundry places semantics above all else. The `def method` syntax
is just a bit of sugar for sending a message of a particular form.

Such design has profound implications on every aspect of the language.

  * This design enables all forms of introspection. Instead of pattern-matching,
    or (likely flawed) forms of partial evaluation, any entity which has a need for
    introspection can just "ask" objects directly, by sending messages to them and
    their classes; additionally, classes can be mutated directly, and they will
    immediately represent a new state.

  * It also favors extreme reification of compiler-internal structures, not unlike how
    syntactic macros greatly favor homoiconicity. In particular, it is convenient to
    have a class Class, which has a map of names to method bodies, names to variable
    types, etc. (The actual implementation is slightly different,
    but out of scope for this post.)

  * Foundry has first-class types, including polytypes and type variables. Types can be
    introspected, rearranged, their parameters used in calculations, etc., by simple,
    imperative metalanguage code. In fact, types are just instances of class Class.
    For example, such function can take a subtype of MachineInteger and produce another
    subtype of MachineInteger with twice the bit width:

{% codeblock lang:ruby %}
def two_times_wider(type)
  MachineInteger.reify(type.parameter(:width) * 2)
end
{% endcodeblock %}

The resulting type can then be used to define a class, method, etc.

I should note that I do not yet allow to execute arbitrary code while solving
constraints in the type signatures; i.e. it is not possible to write a function
with signature `(MachineInteger as 'a) -> two_times_wider('a)` (ML syntax).
It is not yet clear to me whether such feature does more harm than good; however,
all relevant data structures are immutable, so such code is likely to be safe.

  * Foundry allows to extend classes at any moment, but it prohibits all "unextending"
    actions, i.e. removing methods or instance variables. The rationale is that
    "unextending" makes it much harder to enforce typing invariants; i.e. a class
    with instance variable `@a : Integer` may be created, an object with `@a = 1` then
    may be instantiated, and if the variable is removed and re-added as `@a : String`,
    the compiler must traverse the entire heap in order to enforce the invariant again.

    Even if such traversing was sensible with regards to time or space, it still does
    not allow for sensible error messages, so "unextending" is simply prohibited.

  * However, meta-language allows to redefine constants (but not syntactically).

  * Meta-language has strict execution, but lazy typechecking; in other words,
    type constraints for code are only checked when executing the code, not after
    parsing it. In other words again, meta-language does not include type inference
    or unification.

    This solves the problem of recursive definitions, and also allows to write
    code which e.g. defines a type with a method call and then uses that type
    syntactically.

    Implementation-wise, it is expected that meta-language will be implemented as
    a naive AST interpreter. Since most meta-language code is executed only once,
    lack of compilation (incl. JIT compilation) is not expected to hurt performance.

While the semantics of Foundry as a whole almost entirely (with one exception)
corresponds to the semantics of its meta-language, the meta-language alone is
not very useful for the intended task, efficient static compilation. For example,
it is far too expressive to be completely typed in bounded time. Thus, a distinct
object-language is introduced.

(The meta-language on its own is very close to a dynamically typed language
with optional type annotations; while such setup may be useful itself, it is
currently out of scope of my interest.)

The object-language
-------------------

Naturally, object-language exists to allow the compiler to typecheck and
optimize:

  * The only difference in semantics with meta-language is very deliberate;
    in meta-language, it is possible to declare an instance variable as mutable
    or immutable. Object-language adds another state, meta-mutable: a meta-mutable
    variable can be modified from meta-language, but is immutable for object-language.

    Examples of meta-mutable variables include constant tables, method or instance
    variable tables, and other similar structures.

    While a compiler itself is not bound to respect the mutability of a variable,
    such a state is included for completeness, for the ability to describe the
    language in a meta-circular way, and because such variables may be useful for
    application code.

  * Otherwise, object-language is a strict subset of meta-language, semantics wise.
    It is extremely important for cross-compilation; for example, if a target has
    48-bit floating point numbers which do not follow IEEE representation, then
    it must be irrelevant whether meta-language or object-language extract the
    bit pattern from `1.0`; the result must be exactly same.

    (As a curious fact, C compilers already include multiprecision integer
    libraries and target-specific floating point libraries for the purposes of
    constant folding; they just do not provide a way to invoke them
    deterministically.)

  * Meta-language and object-language share object space (i.e. heap). Consequently,
    they share code (in form of closures).

  * Object-language code is not valid unless it can be meaningfully typed; more
    strictly, all type variables must be elided from object-language code before
    it is type-checked and compiled.

  * Consequently, construction of new types is prohibited. (More strictly,
    nothing in the language prevents construction of types, but the data
    layout for every object must be known at compile time; thus, it will
    not be possible to allocate or manipulate instances of such constructed
    types.)

The type inferencer/processor of object-language warrants a more elaborate
explanation. It combines several techniques: the well-known Hindley-Milner
algorithm for local type inference, enhancened with latent predicates as used
in [Typed Scheme][tscheme]; [cartesian product algorithm][cpa] for global type
inference; sparse conditional constant propagation; and limited form of
inlining. The last two transformations (not optimizations; they're not
optional) can be grouped together as bounded partial evaluation.

  [tscheme]: http://www.ccs.neu.edu/racket/pubs/popl08-thf.pdf‎
  [cpa]: http://www.cs.ucsb.edu/~urs/oocsb/self/papers/cpa.html

Unlike in ML, Foundry functions and methods do not intrinsically have a type
signature. In fact, a method can be thought of accepting just two
arguments: `self` and a tuple of arguments, without any particular amount
of arguments or their types. The method body itself then pattern matches
the tuple of arguments and extracts the bound values. (This is a correct
model and it is close to the actual implementation.)

The rationale for this design is that the basic abstraction in Foundry
is message passing. When the sender (call site) emits the message, it
does not possess any knowledge of the internals of the receiving object;
it is up to the object to dispatch the message, or to signal an error.

Such design allows to implement one of the crucial features of OO,
(according to [Alan Kay][oop]: "OOP to me means only messaging,
local retention and protection and hiding of state-process, and extreme
late binding of all things."): message forwarding. Indeed, if an object
does not have a method with the corresponding name (does not _respond to_
the message), the message is dispatched to a special method called
method_missing, which receives message name and all the original arguments.
Method_missing can then decide to process the message itself according
to its name, or forward it to some other object (with a special "send"
method, which is a counterpart to method_missing), or do something else.

  [oop]: http://www.purl.org/stefan_ram/pub/doc_kay_oop_en

While this design prohibits method overloading, it enables a much more
interesting set of features: delegators, dynamically "generated" methods,
or even transparently accessing objects across the network. (Using
Foundry's featureset, it is even possible to do the latter in typesafe
way.)

Foundry uses the cartesian product algorithm together with partial
evaluation to provide sensible global and local type inference in
presence of message forwarding, higher order functions and other advanced
features. I will explain in examples how all of Foundry's type
inferencer/processor components interact and provide a convenient
environment.

Example 1: CPA
--------------

Code:

{% codeblock lang:ruby %}
def adder(lhs, rhs)
  lhs + rhs
end

adder(1, 2) # => 3
adder("a", "b") # => "ab"
{% endcodeblock %}

All methods in Foundry are polymorphic by default; in other words, the
type signature for `adder` can be described as
`'a. 'b. 'c. 'a -> 'b -> 'c` (ML syntax). When the compiler analyses
each call site, it creates a _new_ definition of `adder`, and specializes
it for types of the provided arguments; as such, it creates two variants
with signatures `'a. int -> int -> 'a`, and `'a. str -> str -> 'a`.

For each variant, the same process is performed, resulting in creation
of two variants of `+`; local type inference then replaces the result
type with `int` or `str`, correspondingly (and turns the function type
into a monotype).

It is worth noting that the algorithm is not recursive, but
worklist-based; it also only creates new variants of methods when it
encounters a new combination of types, and otherwise an existing variant
is mutated. These properties allow it to type most recursive and
mutually-recursive functions. If the function recurs on itself in
the left position, e.g. this factorial:

{% codeblock lang:ruby %}
def fact(n)
  if n > 1
    fact(n - 1) * n
  else
    1
  end
end
{% endcodeblock %}

then Foundry will fail to type it; either reversing operands of `*`
or providing an explicit signature will resolve this.

Example 2: SCCP
---------------

In order to fully support metaprogramming, it is very important to
be able to write code polymorphic not only on types, but also on
arbitrary compile-time predicates. For a (somewhat artifical) example,
this method executes fine in the meta-language:

{% codeblock lang:ruby %}
def maybe_with_transaction(object, fn)
  object.start_tx if object.respond_to?(:start_tx)
  fn(object)
  object.finish_tx if object.respond_to?(:finish_tx)
end
{% endcodeblock %}

To provide a smooth abstraction, the object language must support
this pattern, too. Fortunately, the return value of `respond_to?`
is a constant in the object language, and the compiler is able to
propagate it to the `maybe_with_transaction` method.

The case where object responds to the messages is trivial. The
interesting case is when it does not. The code is then equivalent to:

{% codeblock lang:ruby %}
def maybe_with_transaction(object, fn)
  object.start_tx if false
  fn(object)
  object.finish_tx if false
end
{% endcodeblock %}

A naive compiler will not be able to process this code, because
an expression `object.start_tx` cannot be meaningfully typed or
translated to invocation of any method. (A compiler may instead
insert code to generate a runtime error in place of the method
call, but this is not very useful.)

Instead, provably dead code is simply eliminated from the CFG
of the function and is not analyzed further.

SCCP is used because it _combines transformations_: it
optimistically interleaves constant propagation and dead
code elimination, thus being able to remove more provably dead
code than any amount of sequental DCE and CP cycles.

For example, SCCP will successfully simplify this function to `1`:

{% codeblock lang:ruby %}
def cycle
  i = 1
  while i > 10
    i += 1
  end
  i
end
{% endcodeblock %}

It is very important that SCCP in Foundry is not an _optimization_,
that is not optional. While a statement equivalent to
`if(false) { ... }` will likely be removed by a C compiler,
this transformation is not exposed to the programmer, cannot be
relied upon, and, worst of all, does not allow semantic errors to
happen inside.

I acknowledge that SCCP may "hide" bugs caused by errors in the code
which turns out to be dead, but:

  * It's dead anyway.

  * A very simple tooling feature, i.e. statement coverage (where
    a statement is deemed "covered" if it is included in the
    resulting executable), can highlight this type of errors
    statically. To make it useful, a set of unit tests enumerating
    every meaningful combination of types will be necessary; as in
    practice most code is not even polymorphic, the size of such
    testsuite will be mininal.

Example 3: Inlining
-------------------

This code, which uses a higher-order method to iterate through
a tuple of type `str * int' executes just fine in the meta-language:

{% codeblock lang:ruby %}
[ "foo", 42 ].each do |v|
  print(v + v)
end
{% endcodeblock %}

However, how can such code be typed in the object-language? Turns out
there are two obvious solutions:

  * The compiler can infer a union type `str | int`, wrap it in
    a tagged container and pass to the closure. Proliferation of union
    types (and corresponding dispatch tables) generally grows code
    size exponentially, execution time linearly, and prohibits
    further inference and optimization.

    For these reasons, Foundry does not automatically infer union
    types. They still can be specified explicitly, though, and once
    specified, will propagate unmodified through the code.

  * The compiler can infer a polytype for the closure. Foundry does
    not support polytypes in the object-language to avoid placing
    needless restrictions on the value representation.

Instead, when faced with a statement which cannot be typed in
the present form, but can potentially be typed after an equivalent
transformation, Foundry inlines some of the code in question and
performs SCCP again on the result. In particular, this code will
eventually be reduced to:

{% codeblock lang:ruby %}
let [v1, v2] = ["foo", 42]
print(v1 + v1)
print(v2 + v2)
{% endcodeblock %}

or even (after subsequent SCCP):

{% codeblock lang:ruby %}
print("foofoo")
print(84)
{% endcodeblock %}

This approach has several drawbacks:

  * The criteria for inlining are close to being heuristics. It helps
    that Foundry has a limited number of primitive operations which
    can almost never be efficiently translated to machine code (e.g.
    iterating a product type with higher-order methods), and these
    operations can be recursively lifted until they disappear or
    the top level is reached, but this transformation is still less
    rigorously defined than I wish it to be.

  * It can be hard to debug the cases where an operation pops all the
    way to top-level: it may force the compiler to spend significant
    time; despite the fact that Foundry keeps record of all transformations
    and can map the resulting IR back to source, it can be hard to
    produce a sensible error message.

I acknowledge that this solution may not be very elegant, but it
works quite well in practice. I hope it can be further refined in
future work.

CPA, SCCP and inlining together form a predictable, bounded,
algorithmically simple form of partial evaluation. In particular:

  * SCCP is known to scale linearly with code size.

  * I expect CPA to scale linearly on non-pathological inputs; I
    think that Ole Agesen's [paper][cpa] confirms this.

  * Inlining together with mutation of existing function bodies
    means that any inline-able operation will be lifted at most
    _(call stack upper bound without recursion)_ levels higher,
    and will be effectively "memoized" when possible. So, I expect
    this transformation to scale linearly, too.

Thus, the type inferencer and processor should terminate quickly,
as is desirable.

Example 4: Latent predicates
----------------------------

Let's consider this method, which has different control flow depending
on the type of its argument:

{% codeblock lang:ruby %}
def adder(x)
  if x.is_a?(String)
    x + "foo"
  elsif x.is_a?(Integer)
    x + 42
  end
end
{% endcodeblock %}

In an ordinary case of passing an argument of either type `str` or `int`,
CPA and SCCP will ensure that the method loses all its control flow.
However, if the argument has a sum type `str | int`, this is not possible.
Such code executes fine in the meta-language; how do we make it typecheck
and execute in the object-language?

Typed Scheme employs a technique called _[latent predicates][tscheme]_:
in essence, a handful of predicates (like `(number?)` or `(procedure?)`), when
they appear in the conditional, "mark" the passed value as being of the
corresponding type in the calling function. Then, type of the passing
value is locally (in the `#t` branch) narrowed to the tested type.

Foundry employs a similar technique; however, instead of marking methods
with latent predicates, it inlines the `#is_a?` method, and performs analysis
by looking at the SSA IR operations directly. This is more flexible and
allows to implement pattern matching (not shown in the examples) or
arbitrarily complex, user-defined, possibly metaprogrammed predicates
in the same general way.

Example 5: Hygiene
------------------

Since Foundry does not perform syntactic expansion and cannot inject
or use local bindings in an unsafe way, the notion of hygiene does not
directly apply to it. However, it still uses a technique vaguely
similar to quasiquotation, which presents its own challenges.

Consider this code:

{% codeblock lang:ruby %}
def make_adder(name, num)
  define_method(name, (other) do
    other + num
  end)
end

make_adder(:add_five, 5)
add_five(10) # => 15
{% endcodeblock %}

It creates a closure and captures `num` as an upvalue; as one can
see, instead of interleaving the environments, it attaches the
environment of the "macro body" to the environment of the "macro"
itself.

However, as local bindings are immutable by default in Foundry (and
precisely to allow this transformation), the compiler is obliged
(SCCP is not optional) to propagate this constant into the body of
function, and break the environment chain. Similarly, the compiler
is also obliged to lift all mutable bindings not used as upvalues;
these transformations enable a significant amount of consecutive
transformations and optimizations.

Combined with the fact that closures can easily be inlined, e.g.
a closure which is only referenced once is almost always inlined, this
enables one to write code with high-level abstraction and let the
compiler to transform it so that it will be efficiently executed.

I probably should stress again that I don't claim that this tecnhique
somehow represents actual macro expansion. Even when the achieved
effects are similar, in Foundry it is employed in order to make code
more efficient, whereas Lisp-style macros, generally, enable language
extensibility.

Example 6
---------

Suppose a library has undergone an API change; perhaps some arguments
to a class got rearranged. You'd like to release a compatibility shim,
and also log the calls to make sure they're executed correctly.

{% codeblock lang:ruby %}
class CompatibilityShim
  def @delegated : NewClass

  def initialize(delegated)
    @delegated = delegated
  end

  def method_missing(method, *args)
    Logger.log("#{method} called: #{args}")

    let [subject, context, *others] = args
    # note the reordering.
    @delegated.send("new_" + method, context, subject, *others)
  end
end

# somewhere in the user code
object = new CompatibilityShim(get_new_class())
object.foo(subject, context, "hello")
{% endcodeblock %}

When `foo` at the last line is invoked, several interesting things
happen.

  1. `foo` does not exist in CompatibilityShim, so it gets routed
     to method_missing. `method` gets bound to "foo", and `args'
     are bound to [#<subject>, #<context>, "hello"].

  2. `Logger.log` is called. Note the quasiquoted string and the
     presence of `args`; quasiquoted strings imply a conversion by
     calling `#to_s` on the spliced expression, and the tuple "knows"
     how to convert itself to string: by recursively converting its
     elements to strings. A specialized `#to_s` implementation
     is created for whatever's the type of `args`.

  3. `args` get unpacked via a pattern match, and the message is
     then resent to `@delegated` field with the reordered fields.
     Note that tuples also support splicing. (It would be similarly
     possible to use tuple concatenation, indexing, etc and have
     them statically resolved.)

  4. Since there is not enough information to statically determine
     the name of the message `send` should send, the whole
     `method_missing` invocation gets inlined. Then, `"new_" + method`
     expression gets constant-folded to `"new_foo"`.

As you can see, all the transformations I've described are exceptionally
powerful together, and can lead to very concise and expressive code. It
is easy to imagine how the same pattern can be used to access objects
over network without giving up type safety (a corresponding `method_missing`
could access a definition of protocol embedded in compile-time constants,
or even invoke closures created at compile time from said definition),
or to serialize objects, and so on.

Notes
-----

### Language extensibility

I didn't mention language extensibility. I do have plans
for language extensibility facilities in Foundry, which lie in
spirit with its metaprogramming; that is, avoid syntactic expansion.

However, it's a big topic and I'm not ready to comprehensibly
describe it yet.

### Unexpected dead code elimination

C/C++ allow the compiler to perform transformations assuming that
undefined behavior does not happen; this leads to an unfortunate
result that it is not possible to produce a static or dynamic checker
for undefined behavior.

In somewhat similar fashion, Foundry allows the compiler to perform
transformations assuming that dead code does not matter and can
be removed; this leads to a possibly unexpected result that dead
code does not engage in type checking and inference.

I expect that the latter is much less problematic in practice, though.

### Error reporting

Aggressive code transformations may theoretically lead to hard-to-debug
error messages. In fact, the prototype of Foundry did not include any
facilities to comprehensibly report typechecker errors at all.

I am now writing a production-quality Foundry compiler, and its partial
evaluator keeps track of every value through all transformations, and can
map any IR element back to all source locations which influenced it.
This poses its unique set of problems, but lack of information is not
one of them.
