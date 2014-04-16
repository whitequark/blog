---
layout: post
title: "A guide to extension points in OCaml"
date: 2014-04-16 03:53 UTC+4
comments: true
categories:
  - software
  - ocaml
---

Extension points (also known as "`-ppx` syntax extensions") is the new API for syntactic
extensions in [OCaml][]. The old API, known as [camlp4][], is very flexible, but also
huge, practically undocumented, lagging behind the newly introduced syntax in the compiler,
and just overall confusing to those attempting to use it.

Extension points are an excellent and very simple replacement introduced by [Alain Frisch][af].
In this article, I will explain how to amend OCaml's syntax using the extension points API.

[ocaml]:  https://ocaml.org
[camlp4]: http://pauillac.inria.fr/camlp4/manual/
[af]:     http://alain.frisch.fr/

<!--more-->

Note that the features I describe in this article are so bleeding edge, it'll need
constant transfusions just to stay alive. The last transfusion, er, update, happened
on 2014-04-16.

In order to use the extension points API, you'll need a trunk compiler. In order to
achieve anything useful, you would (oh, the irony) need a working camlp4 over the
trunk compiler, which does not exist yet. So for the time being, extension points remain
largely academic.

You can install the trunk compiler with `opam`:

```
opam switch reinstall 4.02.0dev+trunk
```

What is Camlp4?
---------------

At its core, camlp4 (P4 stands for Pre-Processor-Pretty-Printer) is a parsing library
which provides extensible grammars. That is, it makes possible to define a parser
and then, later, make a derived parser by adding a few rules to the original one.
The OCaml syntax (two OCaml syntaxes, in fact, the original one and a [revised][p4r]
one introduced specifically for camlp4) is just a special case.

[p4r]: http://caml.inria.fr/pub/docs/manual-camlp4/manual007.html

When using camlp4 syntax extensions with OCaml, you write your program in a syntax which
is not compatible with OCaml's (neither original nor revised one). Then, the OCaml compiler
(when invoked with the `-pp` switch) passes the original source to the preprocessor as text;
when the preprocessor has finished its work, it prints back valid OCaml code.

There are a lot of problems with this approach:

  * It is confusing to users. Camlp4 preprocessors can define almost any imaginable syntax,
    so unless one is also familiar with all the preprocessors used, it is not in general
    possible to understand the source.
  * It is confusing to tools, for much the same reason. For example, [Merlin][] has
    [no plans][merlin-p4] to support camlp4 in general, and has implemented a workaround
    for few selected extensions, e.g. [pa_ounit][].
  * Writing camlp4 extensions is hard. It requires learning a new (revised) syntax and
    a complex, scarcely documented API (try `module M = Camlp4;;` in utop--the signature
    is 16255 lines long. Yes, sixteen thousand.)
  * It is not well-suited for type-driven code generation, which is probably the most
    common use case for syntax extensions, because it is hard to make different camlp4
    extensions cooperate; [type_conv][] was required to enable this functionality.
  * Last but not the least, using camlp4 prevents OCaml compiler from printing useful
    suggestions in error messages like `File "ifdef.ml", line 17: This '(' might be unmatched`.
    Personally, I find that very annoying.

[merlin]: https://github.com/the-lambda-church/merlin
[merlin-p4]: https://github.com/the-lambda-church/merlin/issues/60
[pa_ounit]: https://github.com/janestreet/pa_ounit
[type_conv]: https://github.com/janestreet/type_conv

What is the extension points API?
---------------------------------

The extension points API is much simpler:

  * A syntax extension is now a function that maps an OCaml AST to an OCaml AST.
    Correspondingly, it is no longer possible to extend syntax in arbitrary ways.

  * To make syntax extensions useful for type-driven code generation (like [type_conv][]),
    the OCaml syntax is enriched with _attributes_.

    Attributes can be attached to pretty much any interesting syntactic construct:
    expressions, types, variant constructors, fields, modules, etc. By default,
    attributes are ignored by the OCaml compiler.

    Attributes can contain a structure, expression or pattern as their _payload_,
    allowing a very wide range of behavior.

    For example, one could implement a syntax extension that would accept
    type declarations of form `type t = A [@id 1] | B [@id 4] of int [@@id_of]` and
    generate a function mapping a value of type `t` to its integer representation.

  * To make syntax extensions useful for implementing custom control flow
    (like [pa_lwt][]), the OCaml syntax is enriched with _extension nodes_.

    Extension nodes designate a custom, incompatible variant of an existing syntactic
    construct. They're only available for expression constructs: `fun`, `let`, `if` and so on.

    Extension nodes have the same payloads as attributes.

    For example, one could implement a syntax extension what would accept
    a _let_ binding of form `let%lwt (x, y) = f in x + y` and translate them to
    `Lwt.bind f (fun (x, y) -> x + y)`.

  * To make it possible to insert fragments of code written in entirely unrelated
    syntax into OCaml code, the OCaml syntax is enriched with _quoted strings_.

    Quoted strings are simply strings delimited with `{<delim>|` and `|<delim>}`,
    where `<delim>` is a (possibly empty) sequence of lowercase letters. They
    behave just like regular OCaml strings, except that syntactic extensions
    may extract the delimiter.

[pa_lwt]: http://ocsigen.org/lwt/api/Pa_lwt

Using the extension points API
------------------------------

On a concrete level, a syntax extension is an executable that receives a marshalled
OCaml AST and emits a marshalled OCaml AST.  The OCaml compiler now also accepts
a `-ppx` option, specifying one or more extensions to preprocess the code with.

To aid this, the internals of the OCaml compiler are now exported as the standard
[findlib][] package `compiler-libs`. This package, among other things, contains
the interface defining the OCaml AST (modules [Asttypes][] and [Parsetree][]) and
a set of helpers for writing the syntax extensions (modules [Ast_mapper][] and
[Ast_helper][]).

I won't describe the API in detail; it's well-documented and nearly trivial (especially
when compared with camlp4). Rather, I will describe all the necessary plumbing one needs
around an AST-mapping function to turn it into a conveniently packaged extension.

It is possible, but extremely inconvenient, to pattern-match and construct the OCaml
AST manually. The extension points API makes it much easier:

  * It provides an `Ast_mapper.mapper` type and `Ast_mapper.default_mapper` value:

{% codeblock lang:ocaml %}
type mapper = {
  (* ... *)
  expr: mapper -> expression -> expression;
  (* ... *)
  structure: mapper -> structure -> structure;
  structure_item: mapper -> structure_item -> structure_item;
  typ: mapper -> core_type -> core_type;
  type_declaration: mapper -> type_declaration -> type_declaration;
  type_kind: mapper -> type_kind -> type_kind;
  value_binding: mapper -> value_binding -> value_binding;
  (* ... *)
}
val default_mapper : mapper
{% endcodeblock %}

  The `default_mapper` is a "deep identity" mapper, i.e. it traverses every
  node of the AST, but changes nothing.

  Together, they provide an easy way to use open recursion, i.e. to only handle
  the parts of AST which are interesting to you.

  * It provides a set of helpers in the `Ast_helper` module which simplify
    constructing the AST. (Unlike Camlp4, extension points API does not provide
    code quasiquotation, at least for now.)

    For example, `Exp.tuple [Exp.constant (Const_int 1); Exp.constant (Const_int 2)]`
    would construct the AST for `(1, 2)`. While unwieldy, this is much better than
    elaborating the AST [directly][ast-direct].

  * Finally, it provides an `Ast_mapper.run_main` function, which handles
    the command line arguments and I/O.

Example
-------

Let's assemble it all together to make a simple extension that replaces `GETENV "<var>"`
with the compile-time contents of the variable `<var>`.

First, let's take a look at the AST that `GETENV "<var>"` would parse to. To do this,
invoke the OCaml compiler as `ocamlc -dparsetree foo.ml`:

{% codeblock lang:ocaml %}
let _ = GETENV "USER"
{% endcodeblock %}

{% codeblock lang:text %}
[
  structure_item (test.ml[1,0+0]..[1,0+21])
    Pstr_eval
    expression (test.ml[1,0+8]..[1,0+21])
      Pexp_construct "GETENV" (test.ml[1,0+8]..[1,0+14])
      Some
        expression (test.ml[1,0+15]..[1,0+21])
          Pexp_constant Const_string("USER",None)
]
{% endcodeblock %}

As you can see, the grammar category we need is "expression", so we need to
override the `expr` field of the `default_mapper`:

{% codeblock lang:ocaml %}
open Ast_mapper
open Ast_helper
open Asttypes
open Parsetree
open Longident
open Location

let getenv s = try Sys.getenv s with Not_found -> ""

let getenv_mapper argv =
  (* Our getenv_mapper only overrides the handling of expressions in the default mapper. *)
  { default_mapper with
    expr = fun mapper expr ->
      match expr with
      (* Is this a constructor? *)
      | {pexp_desc = Pexp_construct (
         (* Should have unqualified name "GETENV". *)
         {txt = Lident "GETENV"},
         (* Should have a single argument, which is a constant string. *)
         Some {pexp_loc = loc; pexp_desc = Pexp_constant (Const_string (sym, None))} )} ->
          (* Replace with a constant string with the value from the environment. *)
          Exp.constant ~loc (Const_string (getenv sym, None))
      (* Delegate to the default mapper. *)
      | x -> default_mapper.expr mapper x;
  }

let () = run_main getenv_mapper
{% endcodeblock %}

This syntax extension can be easily compiled e.g. with
`ocamlbuild -package compiler-libs.common ppx_getenv.native`.

You can verify that this produces the desirable result by asking OCaml to pretty-print
the transformed source: `ocamlc -dsource -ppx ./ppx_getenv.native foo.ml`:

{% codeblock lang:ocaml %}
let _ = "whitequark"
{% endcodeblock %}

[findlib]: http://projects.camlcity.org/projects/findlib.html
[asttypes]: http://caml.inria.fr/cgi-bin/viewvc.cgi/ocaml/trunk/parsing/asttypes.mli?view=markup
[parsetree]: http://caml.inria.fr/cgi-bin/viewvc.cgi/ocaml/trunk/parsing/parsetree.mli?view=markup
[ast_mapper]: http://caml.inria.fr/cgi-bin/viewvc.cgi/ocaml/trunk/parsing/ast_mapper.mli?view=markup
[ast_helper]: http://caml.inria.fr/cgi-bin/viewvc.cgi/ocaml/trunk/parsing/ast_helper.mli?view=markup
[ast-direct]: https://gist.github.com/whitequark/10781334

Packaging
---------

I was going to write a section describing packaging syntax extensions with [findlib][]
and [OASIS][], but it turns out that neither supports them yet and, at least in case
of findlib, it requires modifications to the source code.

Note that it is possible to use ocamlfind for locating the syntax extension with
`ocamlfind ppx_my_precious/my_precious`, where `ppx_my_precious` is the package name,
and `my_precious` is an executable installed in the root of that package (next to `META`).
You would still need to set up the buildsystem rules to do so by yourself.

[oasis]: http://oasis.forge.ocamlcore.org/

Conclusion
----------

The extension points API is really nice, but it's a long road before you can actually
use it.

References
----------

If you are writing an extension, you'll find this material useful:

  * [Asttypes][] and [Parsetree][] modules for writing matchers over the AST;
  * [Ast_helper][] for generating code;
  * [Ast_mapper][] for hooking into the mapper;
  * [extension_points.txt][] for a more thorough high-level description of
    the newly introduced syntax;
  * [experimental/frisch][] directory in general for a set of useful examples.
    Do note that not all of them are always updated to the latest extension
    points API.

Other than the OCaml sources, I've found Alain Frisch's two articles ([1][lexifi1], [2][lexifi2])
on the topic extremely helpful. I only mention them now because they're quite outdated.

[lexifi1]: http://www.lexifi.com/blog/syntax-extensions-without-camlp4
[lexifi2]: http://www.lexifi.com/blog/syntax-extensions-without-camlp4-lets-do-it
[extension_points.txt]: http://caml.inria.fr/cgi-bin/viewvc.cgi/ocaml/trunk/experimental/frisch/extension_points.txt?view=log
[experimental/frisch]: http://caml.inria.fr/cgi-bin/viewvc.cgi/ocaml/trunk/experimental/frisch/
