---
layout: post
title: "A package system for Ruby"
date: 2013-03-22 02:43
comments: true
categories:
  - software
  - ruby
---

You might think: "But Ruby already has a package system! [RubyGems][] or something like that." RubyGems are great, but they are just a _distribution_ system. After they've delivered the files to your system and let you choose the versions, a `require` is just a `require`. It is [a best practice][no-require] not to depend on RubyGems explicitly.

  [rubygems]: http://rubygems.org
  [no-require]: http://tomayko.com/writings/require-rubygems-antipattern

What I wish for is a system which would allow me to determine, without running anything, where did a constant `Funky::Boo` come from, or why do my classes suddenly feature a `yaml_load` method. Interested? Read on.

<!--more-->

Let's get antiglobalistic
-------------------------

Ruby only has three kinds of inherently global entities:

  * Global variables,
  * `Object`, either directly via `::Foo` or indirectly via [cref][],
  * classes of literals: `Module`, `Class`, `Integer`, etc.

  [cref]: http://cirw.in/blog/constant-lookup.html

Every single object you can access has to come by one of these paths. Currently, any file you have `require`'d can modify any of these entities. Sometimes you can determine what caused the change (`Method#source_location`, though it's [harder][prepend] in Ruby 2.0); sometimes not.

  [prepend]: https://bugs.ruby-lang.org/issues/7836

I want a system which allows me to compartmentalize the code and reason about it more easily, yet does not needlessly restrict me or break common idioms.

Also, it's 2013 and we still have to write long lists of `require`'s. It's almost as bad as `#include` and `import`.

A monkey on my back
-------------------

Ruby features _monkey patching_: any class may be changed at any point of time. This is useful for writing [compatibility shims][], debugging, and even [security patches][].

  [shim]: http://en.wikipedia.org/wiki/Shim_(computing)
  [security patches]: https://groups.google.com/forum/?fromgroups=#!topic/rubyonrails-security/4_YvCpLzL58

However, it's widely recognized that uncontrolled monkey patching is harmful. Indeed, Ruby 2.0 features _refinements_, a technique to limit the scope of such changes.

``` ruby
module StringGreeter
  refine String do
    def greet!
      puts "Hello, #{self}!"
    end
  end
end

module Foo
  using StringGreeter

  "World".greet! # prints "Hello, World!"
end

"Bob".greet! # NoMethodError: undefined method `greet!' for String
```

Refinements do have their set of [implementation difficulties][refining], but the consensus among implementers seems to be that a lexical refinements variant does not require a significant performance hit.

  [refining]: http://blog.headius.com/2012/11/refining-ruby.html
