---
layout: post
title: "Statically compiled Ruby"
date: 2011-12-21 09:48
comments: true
categories:
- software
- ruby
- static-ruby
---

Ruby is a very dynamic language by its nature, and it has quite a generalized interface. Everything is an object,
objects communicate only by sending messages to each other, variables are untyped and everything can be modified at
runtime, even (almost) any of the builtins.

This has a serious drawback, through: evaluating Ruby code is a slow process. Even when you have an expression like `5 +
2` (which is syntactic sugar for `5.+(2)`), one cannot safely assume that `+` method has not been redefined as something
completely different. Thus, one is required to follow the generic method lookup procedure, which
[isn't trivial at all][method lookup] and therefore isn't fast either.

  [method lookup]: http://mccraigmccraig.files.wordpress.com/2008/10/ruby-eigenclass.png

I have found a way, through, to significantly improve Ruby code performance by restricting just a few of its
metaprogramming capabilities.

<!--more-->

{% pullquote %}
Strictly speaking, I am placing just a single restriction: {" no method evaluation at runtime "}. This implies inability
to call `load` or `require` after the initial loading process, using `Class.new` or `define_method`, absence of `eval`
family functions, certain operations with singleton classes, nested method definitions (`def a; def b; end; end`)
and maybe a few other, even lesser used features.
{% endpullquote %}

While all of the above may seem like a severe restriction, actually none of those features are commonly used _at
runtime_, and, in fact, if they are actually used, that's a sign of bad code. Even on commonly used interpreters this
will lead to a huge performance drops because of VM cache invalidation.

Due to the fact that all Ruby definitions are just Ruby code, any compiler is thus required to include a fully capable
interpreter. It can be observed that in any typical setting the Ruby application is executed in two stages: at the first
one it just loads all the required libraries and defines classes and methods, and at the second stage it simply executes
the code while abstaining from defining any methods. The first stage is more complex, as it is a superset of the second.

I propose to execute the definition stage on a full-fledged Ruby interpreter like [Rubinius][], and to generate
efficient machine code with [LLVM][] after it is completed. As the method definition (and redefinition) is forbidden
now, it is possbile to perform a lot of optimizations, including constant propagation, type inference and method
inlining, and compile a fully statical executable. Unfortunately this approach does not allow for Ruby MRI C extension
usage, but [FFI][] can compensate for that.

  [Rubinius]: http://rubini.us/
  [LLVM]: http://llvm.org/
  [FFI]: http://en.wikipedia.org/wiki/Foreign_function_interface

Let's dig deeper into the compilation process.

Compilation process
-------------------

First of all, to be able to operate on the AST of entire application we will need a Ruby runtime library which is
written only in Ruby (obviously using [primitives] for basic operations). Currently, there is only one such
implementation--Rubinius--so it is natural to implement the compiler on top of it.

  [primitives]: http://en.wikipedia.org/wiki/Language_primitive

Rubinius provides a lot of methods to inspect its internal state, which will prove to be useful for our purpose.
Particularly, it allows one to retrieve bytecode for any executable object.

I should make a small digression here. While I have mentioned operations on AST, in fact these have a little to do with
an actual abstract syntactic tree of a Ruby source file. The syntax of Ruby is notoriously complex--it's enough to say
that none of alternative implementations have their own parser--and the AST, while being a bit simpler, is still too
complex to allow for convenient transformations. On the other hand, while bytecode only consists of unique opcodes, it
is an internal interface prone to unexpected changes, and in case of Rubinius' bytecode, it is a bytecode for stack VM,
which isn't easily transformed either. The latter can be trivially solved.

<h3>AST transformations</h3>

The bytecode for stack-based VM is isomorphic to a bytecode for a register-based VM, and the most useful form of latter
is a SSA, or [Static Single Assignment][ssa] form. A transformation from stack-based form to SSA is a linear process
which practically consists of assigning a new name for each stack cell when something is pushed into it and using that
name later when the value is popped and used.

  [ssa]: http://en.wikipedia.org/wiki/Static_Single_Assignment

It can be seen that the SSA form is isomorphic to the AST, too, and can be easily folded back to it if necessary. In
fact, this will be implicitly done in the process described later.

At this point, a value for each of the arguments of a particular function call is either a literal, a result of a prior
function call or application of a primitive. Being constant, literals and results of invocation of
[pure functions][pure] can be propagated through the AST. A lot of literals also behave like a pure function in some or
all cases.

  [pure]: http://en.wikipedia.org/wiki/Pure_function

Consider this snippet of code:

``` ruby
sym = :test
puts "the symbol is #{sym}"
```

It may be expanded into the following pseudobytecode:

``` ruby
pushsymbol :test
setlocal 0                  # pop a value and save it as local variable 0
pushstring "the symbol is "
getlocal 0                  # push a value of local variable 0
tostring                    # convert the uppermost value to string
stringconcat 2              # concatenate two uppermost values on the stack
getspecial self             # push the value of self on the stack
send :puts, 1               # send a message :puts to the uppermost value
                            # with 1 next uppermost stack value as an argument
leave                       # return the uppermost value as expression result
```

The directly transformed SSA representation is as follows:

``` ruby
a = :test
setlocal(0, a)
b = "the symbol is "
c = getlocal(0)
d = tostring(c)
e = stringconcat(b, d)
f = self
g = send(f, :puts, [e])
leave(g)
```

After folding all local variable accesses and propagating constants, it looks like this:

``` ruby
leave(
  send(self, :puts, [
    stringconcat(
      "the symbol is ",
      tostring(:test))]))
```

Note the resemblance of resulting structure to an AST.

At this point one can notice that `tostring` and `stringconcat`, apart from being primitives, are pure functions and
their arguments are constant, too. So, we can expand them at compile time.

``` ruby
leave(
  send(self, :puts, [
    "the symbol is test"]))
```

The transformation is finished.

In this short example, only one function call (`puts`) is present. Ruby, where everything is an object, has a lot of
examples where simple operations (like adding integers) are actually implemented through function calls with all the
associated complexity. In this stage, if we see that a function only consists of a single primitive (like `Fixnum#+`),
we can just replace it with that primitive, which may very well translate to a single machine instruction or even be
expanded at compile time. A common Ruby interpreter cannot do that so easily becasue even `Fixnum#+` may be redefined at
any point at the runtime.

<h3>Type inference</h3>

If one could infer method return types from their arguments, then in a lot of cases method lookup can be performed at
compile-time, which not only avoids running the slowest part at runtime, but also allows to inline methods.

To prepare for this step, we need to compute a call graph--a directed and possibly cycled graph with methods as
vertexes and method calls as edges. This graph will be later used to propagate the computed type information from
primitive methods to complex ones. Let's look into this process.

Suppose we have this block of code:

``` ruby
def add(a, b)
  a + b
end

def addi(world)
  add(5, world.to_i)
end

def adds(whimper)
  add("bang! ", whimper.to_s)
end
```

Without taking any of the cross-references into account, not a lot of information could be confidently inferred from the
code. Let's draw a graph for those few bits which could.

{% img center /images/static-ruby/no-xref.png %}

The variables in square brackets represent type specialization for the functions--think of C++ templates--and literals
are marked with blue background. Note that while, by a common convention, methods named `to_s` return `String`, this
convention is not enforced, and hence the compiler cannot rely on it. A value `*`, when used as a type, means that
there is not enough information to do any conclusions on the type of the operand.

A directly derived callgraph for the code above is quite simple:

{% img center /images/static-ruby/callgraph.png %}

Green arrows in the leftwards direction represent function return value types.

One can note that function `addi` always calls `add` with an `Integer` as a first argument, and `adds` similarly
always passes `String`. Looking even further, it becomes clear that for both of the argument types the `+` operation is
a primitive which always returns the same type. So, in our particular case the `add` function has its return type always
the same as that of its first argument. Similarly, the `addi` and `adds` functions just return whatever `add` has
returned.

{% img center /images/static-ruby/callgraph2.png %}

Up to this point, the algorithm was actually implementation- and language-independent. (It is actually a greatly
simplified description of [Damas-Hindley-Milner][dhm] type inference on untyped lambda calculus.) Now, with this
additional knowledge, one can map the now-typed methods to an optimized implementation. In this case, we will get the
biggest benefit from specializing the `add` method and thus avoiding the `+` method lookup on each invocation.

  [dhm]: http://en.wikipedia.org/wiki/Hindley-Milner

{% img center /images/static-ruby/callgraph-opt.png %}

Now, both of these specializations can actually be inlined to avoid method call overhead. As each of them is only
called from one location, this is safe, straightforward and will actually reduce code size.

{% img center /images/static-ruby/callgraph-opt2.png %}

Also, this process will optimize out most, if not all of argument verification code--bound checking (if a constant is
passed), `respond_to?` and similar operations.

<h3>Advanced type inference</h3>

Hindley-Milner type inference only operates on functions, and thus it does not cover some of the problems arising from
the use of objects. For example, an array, being strictly heterogenous, is a "typing black hole": it can accept objects
of any type, and it always emits unqualified objects.

A solution to this problem will be presented in a future article.

<h3>Space optimizations</h3>

As it has been mentioned already, Ruby has a lot of metaprogramming methods, most of which, especially the
introspecting ones, require to keep a lot of data at runtime and sometimes have an impact of performance.

For example, if something is calling `methods` method of an instance of Float, the compiler is required to include
method lists for the entire ancestor chain for Float, which isn't very large, as symbols are used, and to add all of the
method names to the symbol table. The latter would consume 905 bytes (as of MRI 1.9.3), which isn't a big amount for a
desktop system with gigabytes of RAM, but may eat up a significant part of ROM of a microcontroller.

All of the instance variable accesses (including those through `attr` function family) can be compiled to fast indexed
access--that is, unless there is a `instance_variable_set` call somewhere. If there is, a compiler is required to
include a hashtable for looking up instance variables by name, and use a less efficient structure for storage to allow
expanding the table at runtime.

By correctly inferring the possible types for metaprogramming method applications, the compiler can significantly
reduce the space requirements for compiled code. On the other hand, if such a method is applied to unqualified type
(represented by `*` in the graphs), the compiler will then be forced to include metadata for each and every type used.

A way to identify the location of such deoptimizing statements will be provided in the form of detailed optimization
log.

<h3>Code generation</h3>

At last, the machine code is generated. This topic will also be discussed in following articles.
