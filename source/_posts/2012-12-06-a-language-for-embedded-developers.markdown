---
layout: post
title: "A language for embedded developers"
date: 2012-12-06 14:44
comments: true
categories:
 - software
 - ruby
---

I am currently working on a dialect of Ruby well-suited for programing embedded
systems. My goals are to make it fast, flexible and predictable while not giving
up the convenience which Ruby offers.

This article is primarily targeted at software engineers working on embedded
systems and other low-level software, and does not require any prior knowledge
of Ruby. Everyone else is welcome as well.

<!--more-->

Why Ruby?
---------

Ruby is a very expressive language which is built on a foundation of several
simple rules:

 * Everything is an object.
 * Objects have internal state (_instance variables_).
 * Objects send messages to each other. An object never directly accesses
   state of another object.
 * Behavior of objects is defined through classes. If an object is an
   instance of _class A_, then _A_ defines which messages the object
   will accept. A class can inherit one another class, and override its behavior.
 * Messages can be processed programmatically and forwarded to other objects.
   This is how messages differ from method calls.
 * Classes themselves are objects, too. Everything related to classes can be
   changed programmatically: new classes created, existing methods altered,
   new methods defined.

The last clause is especially important. Let me explain this with an example.

``` ruby
# This class encapsulates information about a microcontroller installed
# in some circuit.
class Microcontroller
  # This is a constructor; it initializes a new object.
  # We can create an object like this:
  #
  #   our_core = Microcontroller.new("STM32F100RB", 12_000_000)
  #
  def initialize(name, frequency)
    # @x resembles an instance variable named `x'. It can only be
    # accessed from inside of the object.
    @name      = name
    @frequency = frequency
  end

  # This is an attribute getter. We can query the name of our µC
  # like this:
  #
  #   our_core.name # => "STM32F100RB"
  #
  def name
    # In Ruby, `return' is implicit: value of the last statement is the default
    # return value.
    @name
  end

  def frequency
    @frequency
  end

  # This is an attribute setter. Note how it has the `=' symbol in the name:
  # in Ruby, statement `foo.bar = 1' sends the message named "bar=" to the
  # object `foo'.
  #
  #   our_core.frequency = 48_000_000
  #   our_core.frequency # => 48000000
  #
  def frequency=(new_frequency)
    @frequency = new_frequency
  end
end
```

Don't you think that explicitly writing bodies of accessor methods again and
again is a little verbose? It would be really convenient to do something like
this:

``` ruby
class Microcontroller
  def initialize(name, frequency)
    @name      = name
    @frequency = frequency
  end

  # Parentheses are not required in Ruby. The following line
  # could be written as `attr_reader("name")'.
  attr_reader   "name"
  attr_accessor "frequency"
end
```

... and have the exact same accessor methods to be defined automatically.

Let's look closer at the example. What does `attr_reader :name` in the context
of `class Microcontroller` mean? It means that a message named `attr_reader`
is sent to the class `Microcontroller`, which is itself an object, and is an
instance of class `Class`. We can handle that message!

``` ruby
# In Ruby, you can add new methods to classes at any point of time.
class Class
  def attr_reader(attribute)
    # If a message has no explicit receiver, like here, it is sent
    # to the current object. If this `attr_reader' was invoked from the
    # line above, that would be the class Microcontroller itself.
    #
    # The message `define_method' works just like the `def' syntax, but
    # it allows to specify the method name dynamically.
    define_method(attribute) do
      # This code gets defined as a method on the target class, Microcontroller
      # in our case, so the current object (called `self' in Ruby) is an
      # instance of that class.
      #
      # The message `instance_variable_get' works just like the `@var' syntax,
      # but, again, it allows to specify the variable name dynamically.
      instance_variable_get("@" + attribute)
    end
  end

  def attr_writer(attribute)
    # The `define_method' message accepts a _block_: a chunk of code you can
    # pass around, invoke, or bind as a method to some class. It is just like
    # a function without a name: blocks have arguments and return values.
    #
    # Blocks are also closures: this means that blocks remember the value of
    # variables in the enclosing scope. Here, the block will know the value
    # of `attribute' even when the method `attr_writer' itself has long finished
    # its work and returned.
    #
    # You can think of `attr_writer' as of a macro which converts this:
    #
    #   attr_writer "<attribute>"
    #
    # to this:
    #
    #   def <attribute>=(value)
    #     @<attribute> = value
    #   end
    #
    # but does so in a well-defined and safe way.
    define_method(attribute + "=") do |value|
      instance_variable_set("@" + attribute, value)
    end
  end

  def attr_accessor(attribute)
    attr_reader   attribute
    attr_accessor attribute
  end
end
```

In Ruby, this is called _metaprogramming_: creating programs which themselves
write other programs. This is incredibly convenient. (And, by the way, Ruby
standard library already covers `attr_*` methods and tons of other useful
ones).

This is a solution for the same problem which C preprocessor and C++ templates
solve, but unlike those two entities, implementing their own language which does
not cooperate nicely with the rest of the code, Ruby metaprogramming consists
just of plain Ruby code. You get more expressive power with none of the
complexity!

But Ruby is slow
----------------

If you know just one thing about Ruby, chances that it has to do something with
performance. Frankly, Ruby was never known for its stellar execution speed; more
like the opposite, with execution times [200x higher][benchmarks] than those of
the corresponding C program.

  [benchmarks]: http://shootout.alioth.debian.org/u32/which-programs-are-fastest.php

But why does that happen? Ruby implements _dynamic typing_, which means that
a runtime type of the expression is generally not known until the expression is
evaluated, and it implies that methods shall be _late bound_: again, the
particular method body to be executed generally cannot be known until the moment
of calling that method.

Or, more demonstrably:

``` ruby
def fun
  # Operators in Ruby are simple syntactic sugar for methods.
  # The expression below for all intents and purposes is equivalent
  # to 5.+(10).
  #
  # Numbers are, as everything else, objects; 5 is an instance of
  # class Fixnum.
  5 + 10
end

class Fixnum
  def +(other)
    "caught you"
  end
end

fun # => "caught you"
```

As all classes are _open_, methods can be freely redefined at runtime. You can
see that not even the resulting type of a seemingly constant arithmetic
expression can be known for sure, much less types of more complex expression.

(Yes, this example does not contain code you will ever want to write.
Nevertheless, redefining operators even on built-in types can have its valid
applications; think of overriding `Fixnum#/` to return a precise rational value
instead of a rounded integer.)

This property poses a huge problem to Ruby implementations, as Ruby code almost
entirely consists of method calls and absolutely nothing is known about method
calls in advance. Thus, an implementation either performs method lookup each
time the method is invoked, or does sophisticated runtime profiling to determine
which method will be _probably_ called at a given call site, and optimizes
accordingly.

Runtime method lookup itself isn't very fast, but what's worse is that it
completely prevents one of the most powerful optimizations, inlining, from
happening. Doing runtime profiling and just-in-time optimization yields much
better results, but is inherently unpredictable (a compiler may interrupt your
computation at virtually any moment), is incredibly complex (thus error-prone)
and, finally, consumes vast amount of resources, especially RAM. This can be
fine at large-scale servers, but doesn't really work for most embedded devices.

The only solution to this problem is to make method calls _eagerly bound_, or,
in other words, resolve them at compile-time.

One does not simply compile Ruby
--------------------------------

Unfortunately, statically figuring out types in a general Ruby program is
impossible. For example, all Ruby arrays can hold elements of any type, and in
fact it is not possible to restrict them to holding one particular type of
elements even if you'd want to do it. This is indeed both a strength and a
weakness of Ruby.

I've solved this problem by adding static runtime typing to Ruby. Conceptually,
this changes very little: Ruby retains its object-oriented semantics completely,
metaprogramming is not affected as long as it does not happen at runtime (which
is quite a bad idea anyway), and so on. In fact, this change is little more than
a convenient syntactic sugar for adding appropriate type conversions; further,
type inference ensures that you won't even need to declare types explicitly in
a lot of cases.

What's interesting is that this change enables me to extend Ruby semantics
in completely new ways. Most importantly, I've added _generics_, configurable
types, and they allowed me to adapt standard library for more low-level
applications.

What features does it have?
---------------------------

Quite a few.

### Arbitrary precision integers

`char`? `unsigned long`? That's too many identifiers to remember. Integer types
are instantiated as simply as `Int32 = Integer.reify(32, :signed)` or
`UInt16 = Integer.reify(16, :unsigned)`. Yes, if your DSP has only 24-bit and
36-bit registers, arithmetics will be just as optimal as 32-bit on common ARMs.

### Generic containers

If you're decompressing an ogg-encoded audio file and need an array to store raw
data, you can instantiate it as simple as `@data = Array.reify(UInt16).new`.
As integers have value semantics (i.e. cannot be modified in-place), the array
will store them directly, faciliating efficient memory use.

All containers used at runtime must have a reified type, but (if you already
know Ruby) don't worry: both intermediate arrays and hashes used to pass keyword
arguments are handled by compiler and don't require any special treatment.

### Complete control over memory layout of objects

Do you want to have a class representing an IP packet header to have the same
in-memory structure as the actual header? OK, you can do that. Also, bitfields
which _actually work_, are translated to memory accesses with correct alignment
and take just a few lines to define.

### Fast method calls

Method calls are either translated to a machine call instruction directly or
use a _vtable_ mechanism for the cases where subclasses can be passed where
base classes are expected. [Liskov substitution principle][liskov] still
applies, as well.

  [liskov]: http://en.wikipedia.org/wiki/Liskov_substitution_principle

### Modern optimizations

Constant folding, inlining, strength reduction, loop-invariant code motion,
you name it. The machine code is generated by LLVM, which is well know for its
efficiency and extensibility, and the compiler itself does a fair amount of
analysis as well.

### Automatic memory management

This decision can be controversional, but I've decided to avoid manual memory
management. A focus is put on automated reference counting, with garbage
collection as a possible option in the future. Yes, reference loops are bad,
but GC delays can be even worse.

### Efficient closures

This nicely object-oriented code working with Arrays is actually faster than
the naïve implementation which uses plain old `while` loop:

``` ruby
foo = Array.reify(UInt32).new([ 1, 1, 2, 3, 5 ])

# This...
foo.each do |i|
  work_on(i)
end

# ... is actually faster than this...
i = 0
while i < foo.length
  work_on(foo[i])
  i += 1
end
```

Why? Because that eliminates bounds checking as well as repetitive `length`
call, thus retaining safety yet making the code easier to read. The compiler
checks whether the closure will live after its containing scope is destroyed,
and only allocates it on the heap if that's actually needed. In this particular
case, the closure will actually be inlined to the enclosing scope.

### Stack-allocated temporaries

The compiler performs escape analysis and, if a certain object doesn't leave
its enclosing scope, it will be automatically marked as stack-allocated, thus
decreasing heap traffic.

### Lightweight coroutines and generators

Language-provided coroutines eliminate the need for simplest RTOSes and allow
to use safe multithreading patterns such as [Actor][]. [Generators][] are a
useful abstraction tool, and with fair amount of static analysis there is no
need to allocate an entire stack just to pass a trivial sequence generator
around.

  [actor]: http://en.wikipedia.org/wiki/Actor_model
  [generators]: http://en.wikipedia.org/wiki/Generator_(computer_programming)

### C interoperability

You retain the ability to use legacy C code by defining its interface through
[FFI][]; if the entire project uses LLVM, inter-language optimizations are
perfectly possible.

  [FFI]: https://wiki.github.com/ffi/ffi

### Direct memory access

A fair amount of low-level programming tasks require one to perform direct
memory access on specific addresses, most notably to work with hardware
registers. Nothing prevents a high-level notation like `GPIOA.set(10)`
to compile to an efficient read-modify-write cycle.

### Interrupt handlers

Support for interrupts is provided out of the box. No weird assembly hacks
required.

### Well-defined memory model

[C++11 memory model][mm] is used as a reference to provide efficient atomic
operations with well-defined ordering characteristics.

  [mm]: http://en.wikipedia.org/wiki/C%2B%2B11#Multithreading_memory_model

### Customizable compiler

Microcontrollers are well known for their unusual features, which commonly don't
map directly to languages specified at a lower level. Ruby language itself does
not specify anything hardware-related itself, and thus nothing prevents a
sophisticated compiler to take advantage of features like [bitband areas][bb]
on Cortex-M3 chips.

  [bb]: http://infocenter.arm.com/help/index.jsp?topic=/com.arm.doc.dui0552a/Behcjiic.html

### Completely written in Ruby

The whole compiler is written in Ruby, and all of the standard library is
written in the eponymous dialect of Ruby.

### Board support packages

A compiler, as good as it may be, is useless without a matching BSP for your
microcontroller. That's what you get, too.

How does it look like?
----------------------

Pretty much like plain Ruby, but method definitions are sometimes annotated with
types:

``` ruby
def sum(Array[Fixnum] numbers): Fixnum
  result = 0

  numbers.each do |number|
    result += number
  end

  result
end
```

Note how the type of a variable `result` isn't specified. It is inferred
automatically at the point of first assignment and enforced later.

The return type is specified explicitly, but it could be omitted here, as it
can be inferred from the type of variable `result`.

In fact, this whole function can be written without explicitly specified types
at all! Compiler is clever enough to infer the type of its sole argument from
the call sites where the function is referenced, and it will create a version
of the functions for each distinct set of argument types. This way, [duck typing][]
is still possible in a completely statically typed language.

  [duck typing]: en.wikipedia.org/wiki/Duck_typing

How does it work?
-----------------

_This section requires Ruby knowledge._

With a set of builtin functions and some amount of syntactic expansion.

In method definition, a type specification of `Array[Fixnum]` is equivalent
to `Array.reify(Fixnum)`, which is just a class method which returns another
class. On the other hand, when the compiler needs to ensure that a value is of
a certain type, it inserts a call to `coerce`: the method `sum` actually returns
the value of `Fixnum.coerce(result)` (which is most certainly a no-op).

The standard library or user-defined classes can then use these two methods to
implement reification or conversion semantics.

This is how the Array class could implement genericality:

``` ruby
class Array
  def self.reify(contained_type)
    Class.new(Reified) do
      @@element_type = contained_type
    end
  end

  class Reified < Array
    def [](Fixnum index): @@element_type
      # Runtime.* methods are intrinsic.
      Runtime.raw_array_lookup(@storage, index, @@element_type)
    end

    def []=(Fixnum index, @@element_type value)
      Runtime.raw_array_store(@storage, index, @@element_type, value)
    end
  end
end
```

Can I try it?
-------------

No. The project is not ready for public beta yet. Expect it in a few months.

Is it free? Is it open-source?
------------------------------

This is a commercial project. I believe that I would not be able to make this
product as good as it should be if it would be non-commercial; on the other
hand, I consider open-source a vastly superior development model. Stay tuned.

How does it compare to language X?
----------------------------------

I don't consider myself knowledgeable enough on the very diverse topic of the
programming languages to write such comparisons; furthermore, I do not aim on
"replacing" any particular programming language. My goal is to make embedded
development easier and more efficient than before. If you think my project would
help you to achieve that goal, you're welcome!

Why are you posting this now?
-----------------------------

Because, as I've stated before, programming languages is a very wide topic, and
so is embedded development. It is better to figure out where am I wrong earlier
than to trip on that later. Feedback is very welcome, both positive and negative.

**Thank you for reading.**