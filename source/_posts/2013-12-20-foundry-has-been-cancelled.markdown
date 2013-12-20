---
layout: post
title: "Foundry has been cancelled"
date: 2013-12-21 01:44
comments: true
categories:
  - software
---

Two years ago on this day I started working on Foundry, and I developed [some][f1] [nice][f2]
[things][f3], including prototypes of both the language and the compiler. Today I'm cancelling
the project.

The reason is simple and technical. The idea behind Foundry was to take the convenience Ruby offers,
and transplant it to a statically typed language. My chosen implementation path involved global
type inference in every interesting aspect of it. While powerful, this technique makes writing
closely-coupled, modular code hard, separate compilation impossible, and error messages become
even more cryptic than [those of C++][cpperr].

Simply put, this is not a language I myself would use. Also, I could not find a way to get rid of
global type inference which didn't involve turning the language into a _not invented here_ version
of C#, Rust or what else.

Lessons? Don't design a language unless you have a very good reason to. By all means, **do** design
a language if your idea is fancy enough. And don't use global type inference, it sucks.

Now go and check out [Rust][rust]. It gets better every day.

  [f1]: /blog/2011/12/21/statically-compiled-ruby/
  [f2]: /blog/2012/12/06/a-language-for-embedded-developers/
  [f3]: /blog/2013/07/30/metaprogramming-in-foundry/
  [cpperr]: http://tgceec.tumblr.com/
  [rust]: http://rust-lang.org/
