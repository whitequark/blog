---
layout: post
title: "Parsing Ruby"
date: 2012-10-02 04:39
comments: true
categories:
---

Suppose you need to parse a chunk of Ruby code (and by Ruby I obviously mean Ruby 1.9). What options do you have?
<!--more-->

I want to rip it, rip it
------------------------

The obvious choice is [Ripper](http://www.ruby-doc.org/stdlib-1.9.3/libdoc/ripper/rdoc/Ripper.html), an external interface to the Ruby's parser which is distributed with the MRI Ruby itself. Let's take a look...

``` ruby
pry> require 'ripper'
=> true
pry> Ripper.sexp 'def hello(greet="world"); puts "hello #{greet}"; end'
=> [:program,
 [[:def,
   [:@ident, "hello", [1, 4]],
   [:paren,
    [:params,
     nil,
     [[[:@ident, "greet", [1, 10]],
       [:string_literal,
        [:string_content, [:@tstring_content, "world", [1, 17]]]]]],
     nil,
     nil,
     nil]],
   [:bodystmt,
    [[:void_stmt],
     [:command,
      [:@ident, "puts", [1, 26]],
      [:args_add_block,
       [[:string_literal,
         [:string_content,
          [:@tstring_content, "hello ", [1, 32]],
          [:string_embexpr, [[:var_ref, [:@ident, "greet", [1, 40]]]]]]]],
       false]]],
    nil,
    nil,
    nil]]]]
```

Oh. Not really friendly for processing. What's worse, Ripper does not feature error handling at all:

``` ruby
pry> Ripper.sexp 'Hey, would you like to#$%$#$!NO CARRIER'
=> [:program,
 [:command,
  [:@ident, "you", [1, 11]],
  [[:command,
    [:@ident, "like", [1, 15]],
    [:args_add_block, [[:vcall, [:@ident, "to", [1, 20]]]], false]]]]]
pry> Hey, would you like to#$%$#$!NO CARRIER
SyntaxError: unexpected tIDENTIFIER, expecting keyword_do or '{' or '('
Hey, would you like to#$%$#$!NO CARRIER
              ^
```

Unless you're implementing something that obeys the garbage-in garbage-out rule, Ripper isn't very useful. To make it worse, there isn't a cross-platform gemification of Ripper, or at least I was unable to find one.

It's s-expressions all the way down
-----------------------------------

The next variant is [ruby_parser](https://github.com/seattlerb/ruby_parser). It's implemented in pure Ruby and has a totally awesome output format:

``` ruby
pry> require 'ruby_parser'
=> true
pry> RubyParser.new.parse('-> { 1 + 2 }')
=> s(:iter, s(:call, nil, :lambda), 0, s(:call, s(:lit, 1), :+, s(:lit, 2)))
pry> RubyParser.new.parse('def hello(greet="world"); puts "hello #{greet}"; end')
=> s(:defn,
 :hello,
 s(:args, :greet, s(:block, s(:lasgn, :greet, s(:str, "world")))),
 s(:call, nil, :puts, s(:dstr, "hello ", s(:evstr, s(:lvar, :greet)))))
```

There's a little problem with ruby_parser, through. Ripper has a horrible interface, but I'm pretty certain that it parses the source _correctly_, simply because it works on gigabytes of production Ruby code. Ruby_parser, on the other hand, has a nice battery of tests, but also has tons of little issues, both known and unknown.

For example, each Rubyist has used _irb_ at some point. Consider this snippet:

``` ruby
irb> a = 1
=> 1
irb> a
```

You could replicate it in pure Ruby with the following code:

``` ruby
scope = binding
eval("a = 1", scope)
eval("a", scope) # => 2
```

It is more complex than it looks like. At the second line, the local variable `a` is accessed, but a bareword like that could refer to either a variable or a method if there's no such variable. How does Ruby distinguish between these cases? At the time of parsing the code it doesn't know anything about the passed binding or local variables in it.

It turns out that Ruby MRI's parser has three different AST nodes for method calls, named `call`, `vcall` and `fcall`. Behold:

``` ruby
pry> Ripper.sexp('a')
=> [:program, [[:vcall, [:@ident, "a", [1, 0]]]]]
pry> Ripper.sexp('a()')
=> [:program,
 [[:method_add_arg, [:fcall, [:@ident, "a", [1, 0]]], [:arg_paren, nil]]]]
pry> Ripper.sexp('self.a')
=> [:program,
 [[:call, [:var_ref, [:@kw, "self", [1, 0]]], :".", [:@ident, "a", [1, 5]]]]]
```

So, if the node is of `vcall` type and the current scope is an eval scope with a binding passed, the interpreter will perform a local variable access instead. Neat.

Now, what about ruby_parser?

``` ruby
pry> # I'm using ruby_parser 3.0.0.a8, latest at the time of writing
=> nil
pry> RubyParser.new.parse('a')
=> s(:call, nil, :a)
pry> RubyParser.new.parse('a()')
=> s(:call, nil, :a)
```

There are lots of dark corners in Ruby syntax: multiple assignment, default argument handling, 1.9 block syntax extensions... Don't get me wrong: I think that ruby_parser is the way to go, but frankly I'm not ready to go bughunting and write thousands of test LOC to verify every aspect of its behavior.

Just add some Australium
------------------------

Rubinius uses a slightly different approach: its authors opted to extract the Bison grammar from Ruby MRI sources, clean it from unneeded dependencies on the MRI internals and rework it to emit a clean AST instead. The resulting module was called Melbourne, and you can trivially invoke it from within Rubinius.

``` ruby
irb> Rubinius::Melbourne19.parse_string("1 + 2").ascii_graph; nil
SendWithArguments
  @privately: false
  @check_for_local: false
  @vcall_style: false
  @block: nil
  @name: :+
  @line: 1
  @receiver: \
    FixnumLiteral
      @value: 1
      @line: 1
  @arguments: \
    ActualArguments
      @array: [
        FixnumLiteral [0]
          @value: 2
          @line: 1
      ]
      @splat: nil
      @line: 1
=> nil
```

You can also convert that AST to the concise ruby_parser format, and you won't have to handle any of its quirks! Melbourne is pretty much production-grade software.

``` ruby
irb> Rubinius::Melbourne19.parse_string("a()").to_sexp
=> [:call, nil, :a, [:arglist]]
irb> Rubinius::Melbourne19.parse_string("a").to_sexp
=> [:call, nil, :a, nil]
irb> pp Rubinius::Melbourne19.parse_string(%q|def hello(greet="world"); puts "hello #{greet}"; end|).to_sexp; nil
[:defn,
 :hello,
 [:args, :greet, [:block, [:lasgn, :greet, [:str, "world"]]]],
 [:scope,
  [:block,
   [:call,
    nil,
    :puts,
    [:arglist, [:dstr, "hello ", [:evstr, [:lvar, :greet]]]]]]]]
=> nil
```

Unfortunately, until recently you couldn't actually use Melbourne on anything except Rubinius, because while a gemification of it [did exist](http://rubygems.org/gems/melbourne), it was based on a very outdated, 1.8-only version of the parser. So, I have [updated](http://github.com/whitequark/melbourne) the Melbourne gem, forward-porting every new feature from the Rubinius source while keeping the old API. It's not [merged](https://github.com/simplabs/melbourne/pull/2) to the upstream repository yet, but it will be soon.

There's another problem with Melbourne, or, more precisely, with its ruby_parser compatibility layer. Ruby_parser has subclassed Array for its s-expression format, and added some useful methods like `#line`. Melbourne, on the other hand, emits raw arrays, and there's no source location information available in them. I'm [planning](https://github.com/simplabs/melbourne/issues/3) to handle this, too.

``` ruby
pry> tree = RubyParser.new.parse("hello\nworld")
=> s(:block, s(:call, nil, :hello), s(:call, nil, :world))
pry> tree[2]
=> s(:call, nil, :world)
pry> tree[2].line
=> 2

irb> tree = Rubinius::Melbourne19.parse_string("hello\nworld").to_sexp
=> [:block, [:call, nil, :hello, nil], [:call, nil, :world, nil]]
irb> tree[2].line
NoMethodError: undefined method `line' on an instance of Array.
...
irb> # Ouch.
```

So, now there is a cross-platform Ruby parser gem with a sane output format. Let the analysis begin!