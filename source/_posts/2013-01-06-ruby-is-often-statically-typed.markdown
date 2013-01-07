---
layout: post
title: "Ruby is (often) statically typed"
date: 2013-01-06 21:29
comments: true
categories:
 - ruby
---

Rubyists have a very distinct dislike for everything explicit. It comes as no
surprise that we despise [manifest typing][] as well. Due to unfortunate
prevalence of statically typed languages which also feature manifest typing
in the last two decades, these terms are somewhat conflated. They are, however,
orthogonal.

Ruby has a lot of static typing present, both explicit and implicit, and I'm
going to explain where it is and how it can be used.

  [manifest typing]: http://en.wikipedia.org/wiki/Manifest_typing

<!--more-->

Manifest typing? What are you talking about?
--------------------------------------------

Type systems can be classified on several unrelated axes. The ones important
for this article are _manifest typing_ ↔ _implicit typing_ and _static typing_
↔ _dynamic typing_. _Duck typing_ is a technique related to dynamic typing.

Languages with manifest typing (examples: C, Ada, Java) require the programmer
to annotate every declaration with an associated type. Some languages perform
parts of this cumbersome task automatically when it would be unambiguous anyway
(examples: C++11, Haskell, Go); this is called _type inference_. As another
option, a language may omit explicit type annotations entirely (examples:
Ruby, Python). Unless such a language allows to perform every operation on
every single type{% fn_ref 1 %}, ths approach requires at least some type checks
to be performed at runtime.

Static typing means that the language itself always trusts you and assumes that
whatever object you use actually has the type you say it does. In some cases the
compiler would go to great lengths to prevent you from shooting yourself in the
leg and performing an operation upon a wrong type (Java, Ada); others will only
warn you (C++). Note that a sufficiently motivated programmer will always find a
way to crash his program, and no amount of compile-time checks will prevent that.

On the other hand, dynamically typed languages always check if the value
is actually suitable for that operation you're about to perform on it. This
generally makes error messages better; you can remove compile-time verification
from C++, but a lone `Segmentation fault` doesn't give you a slightest hint of
which of your 100 KLOC is erroneous. You can also go opposite direction and
defer all type checking in C to runtime. It wouldn't be very wise, of course.

Static typing also allows a compiler to easily perform a number of important
optimizations, such as performing method lookup (or parts thereof{% fn_ref 2 %})
at compile-time.

[Duck typing][] boils down to a simple fact: in a dynamic language there is no
effective difference{% fn_ref 3 %} between a plain Array and a class which
implements every method of an Array, but fetches the elements from a remote
REST endpoint instead.

  [duck typing]: http://en.wikipedia.org/wiki/Duck_typing

What is a type system, anyway?
------------------------------

Simply put, a _type system_ allows a language implementation to argue about
your code: to make a hypothesis and then prove (or refute) it.

``` c
int main() {
  unsigned int x = get_external_data();

  if(x < 0) {
    puts("Woohoo!");
  }

  return 0;
}
```

While processing the code above, an optimizing C compiler might hypothesize that
the condition body will never be executed. It will then prove this fact by
taking into account that `unsigned` integers, by definition, can never be less
than zero. As a result, it can achieve several desirable consequences, namely
a decrease in code size due to omitting the body completely, and an increase in
performance due to omitting the condition. Even better, it can warn the programmer
about an useless condition and possibly{% fn_ref 4 %} prevent an error.

Note that the definition of a type system doesn't contain anything about _data_.
Indeed, there are languages which use type systems to argue about the _code_ as
of itself. An example would be Haskell: a brilliant idea cut to death by a
thousand endomorphisms.

We ain't got no unsigned ints in Ruby
-------------------------------------

To begin with, Ruby contains quite a few methods with static type signatures
requiring a very certain class to be present. As a trivial example, `Class.new`
won't accept anything except a real class{% fn_ref 5 %}:

``` ruby
> duck_type_Object = Object.new.tap { |o| def o.method_missing(*args) Object.send(*args) end }
=> #<Object:0x00000002e68528>
> duck_type_Object.name
=> "Object"
> duck_type_Object.new
=> #<Object:0x00000002f5c880>
> Class.new(duck_type_Object)
TypeError: superclass must be a Class (Object given)
```

A more interesting example would be `Array#flatten`. How does it determine that
a certain element is a subarray? By trying to call `#to_ary`:

``` ruby
> [ 1, Object.new.tap { |o| def o.to_ary; [2,3]; end } ].flatten
=> [1, 2, 3]
```

But what if we'd returned _something else_ than an instance of Array from the
`#to_ary` method?

``` ruby
> [ 1, Object.new.tap { |o| def o.to_ary; :foo; end } ].flatten
TypeError: can't convert Object to Array (Object#to_ary gives Symbol)
```

Boom! Another type requirement lurking deep inside Ruby. You don't even have a
chance to return something else implementing `#to_ary` here, or a subclass of
`Array`; you need a real instance of `Array` and nothing else.

To quack like a goose
---------------------

Let's say we have a job queue.

``` ruby
class JobQueue
  def initialize
    @queue = []
  end

  def add(job)
    @queue.push job
  end

  def process
    until @queue.empty?
      job = @queue.shift
      job.perform
    end
  end
end
```

Does the `job` variable have a type here? Turns out it does. As you remember,
knowledge of a type of a certain entity allows the compiler to predict the
behavior of the code. Here, if at line 13 whatever object is the `job` does
not respond to the `perform` method{% fn_ref 6 %}, a type error (disguised as
a NoMethodError) will be raised.

This fact might be expressed as a type: `{(perform)}`. If you would call a
`(success?)` method next, the type would be altered to `{(perform) (success?)}`
to reflect this. By induction, you could propagate the type to the `#add`
method and potentially catch an error before it happens{% fn_ref 7 %}.

Sounds useful
-------------

Unfortunately, performing such analysis on the code in general case is not
trivial. In fact, it can be proven that it is [Turing-undecidable][tundec] due
to `method_missing` alone, and presence of extremely non-local effects such as
monkey patching and singleton classes makes it quite hard to perform even
approximate analysis.

  [tundec]: http://en.wikipedia.org/wiki/Undecidable_problem

However, there are cases where this approach is sound. [Duck typing][d1]
[in Ruby][d2] [is hard][d3] [and][d4] [error-prone][d5], whereas in Go it is
[way better][gotyping].

  [d1]: http://blog.rubybestpractices.com/posts/gregory/046-issue-14-duck-typing.html
  [d2]: http://blade.nagaokaut.ac.jp/cgi-bin/scat.rb/ruby/ruby-talk/100511
  [d3]: http://allmyhate.host.sk/ruby/0321474074/Duck-Typing.html
  [d4]: http://threebrothers.org/brendan/blog/death-by-duck-typing/
  [d5]: http://www.thisdev.com/2008/02/myth-of-duck-typing.html
  [gotyping]: http://blog.carbonfive.com/2012/09/23/structural-typing-compile-time-duck-typing/

Most importantly, there are some common cases where type checking is trivial.
As I've demonstrated, `to_ary` must return an `Array`. While `to_a` technically
can return something which is not `Array`, arrays in Ruby have a very extensive
interface, and I've yet to see a class which implements it all and is not an
`Array` subclass or delegator. Even worse, if your class _almost_ implements
the `Array` interface, or does it *almost* correctly, the resulting errors will
be extremely hard to find.

This kind of analysis isn't performed by mainstream Ruby implementations,
through; the resulting optimizations can be achieved in a more general and
simple way by other means, and without stronger guarantees about object behavior
type annotations aren't very useful. They are, however, [trivial to add][typeann].

  [typeann]: http://www.codecommit.com/blog/ruby/adding-type-checking-to-ruby

Doesn't sound very useful
-------------------------

You might be wondering now: "What's the point of this article? Sure, these facts
are mildly interesting, but we can't make any use of them anyway."

I'm currently [developing][embprog] a systems programming language with syntax
and semantics based on those of Ruby, but featuring runtime static typing and
compile time metaprogramming, a concept not commonly found in new systems
programming languages (looking at you, Go and Rust{% fn_ref 8 %}).

  [embprog]: http://localhost:4000/blog/2012/12/06/a-language-for-embedded-developers/

So, I aimed to demonstrate that Ruby already has bits of static typing baked in,
that it doesn't require endless streams of declarations, and that it can help
the compiler and the programmer alike. Even better, type annotations can fit
perfectly in Ruby's semantics and improve it instead of being too verbose and
cumbersome to maintain.

### Footnotes

{% footnotes %}
  {% fn %} Can you imagine a completely statically typed language without any
type annotations? How practical do you think will it be? Hint: you're using
one right now (indirectly). It's called "assembly".
  {% fn %} Static and non-virtual methods get called directly. Virtual methods
get called through one level of indirection, which can be thought of as a cache
filled by the compiler.
  {% fn %} Theoretically. This abstraction breaks down way more often than we
would like.
  {% fn %} Autogenerated code can contain such useless statements which are
inserted intentionally. It is easier to let the compiler argue about the code
rather than doing it all by yourself.
  {% fn %} This example is not unrealistic. It would be nice to be able, for
example, instrument method lookup from within the interpreter with plain Ruby.
  {% fn %} I'm intentionally omitting possible `ArgumentError`s for simplicity.
  {% fn %} [Diamondback Ruby](http://www.cs.umd.edu/projects/PL/druby/) tries
to do exactly this.
  {% fn %} Rust [advertises](http://www.rust-lang.org/) metaprogramming support,
but I've yet to see it work in reality. That being said, I love this little
language.
{% endfootnotes %}
