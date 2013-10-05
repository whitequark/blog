---
layout: post
title: "Let's play with Ruby code"
date: 2013-04-26 07:49
comments: true
categories:
  - software
  - ruby
---

Are you tired of aligning those pesky equality signs by hand? Do you obsess over using (or not using) `and`, `do` and `then`? Do you want to enforce your corporative style guide without fixing all the indentation by hand?

All of the above, and without accidentally breaking code structure and unrelated formatting?

[Parser](http://github.com/whitequark/parser) has you covered.

<!--more-->

"Parser"? What's that?
----------------------

Parser is a gem for parsing Ruby code which I wrote. Unlike most other Ruby parsers, it keeps precise location information for all nodes:

```
$ gem install parser
$ ruby-parse -L -e 'if foo then bar end'
(if
  (send nil :foo)
  (send nil :bar) nil)
if foo then bar end
~~ keyword      ~~~ end
       ~~~~ begin
~~~~~~~~~~~~~~~~~~~ expression
(send nil :foo)
if foo then bar end
   ~~~ selector
   ~~~ expression
(send nil :bar)
if foo then bar end
            ~~~ selector
            ~~~ expression
```

It also parses all Ruby code in existence by supporting 1.8, 1.9, 2.0 and upcoming 2.1 syntax, and is written in pure Ruby.

Equality for everyone
---------------------

Parser also supports rewriting: non-intrusively (with regard to formatting) modifying source code by applying deltas based on recorded location information.

Let's start with an example: aligning equality signs. First, how does the AST look like?

```
$ ruby-parse -e $'@definition = defn\nsource = "foo"\nunrelated(:method_call)'
(begin
  (ivasgn :@definition
    (send nil :defn))
  (lvasgn :source
    (str "foo"))
  (send nil :unrelated
    (sym :method_call)))
```

So, we're looking for several consecutive assignment nodes inside a grouping `(begin)` node. How do we locate the equality sign?

```
$ ruby-parse -L -e $'@definition = defn'
(ivasgn :@definition
  (send nil :defn))
@definition = defn
~~~~~~~~~~~ name
            ~ operator
~~~~~~~~~~~~~~~~~~ expression
(send nil :defn)
@definition = defn
              ~~~~ selector
              ~~~~ expression
```

The sign is located by the `operator` field of the source map; if `node` is an [AST::Node](http://whitequark.github.io/ast/frames#!AST/Node), then `node.loc.operator` would refer to the [Parser::Source::Range](http://rdoc.info/github/whitequark/parser/master/frames#!Parser/Source/Range) for the `=` sign.

The AST format has a [reference](http://rdoc.info/github/whitequark/parser/master/frames#!file/doc/AST_FORMAT.md), but it's often faster to just try it out and look at the output of `ruby-parse`.

Parser also includes a convenient harness, [Parser::Rewriter](http://rdoc.info/github/whitequark/parser/master/frames#!Parser/Rewriter) for writing simple rewriters. It allows you to schedule modifications to the source while walking through the AST. Let's use it!

{% codeblock align_eq.rb lang:ruby %}
class AlignEq < Parser::Rewriter
  def on_begin(node)
    eq_nodes = []

    node.children.each do |child_node|
      if assignment?(child_node)
        eq_nodes << child_node
      elsif eq_nodes.any?
        align(eq_nodes)
        eq_nodes = []
      end
    end

    align(eq_nodes)

    super
  end

  def align(eq_nodes)
    aligned_column = eq_nodes.
      map { |node| node.loc.operator.column }.
      max

    eq_nodes.each do |node|
      if (column = node.loc.operator.column) < aligned_column
        insert_before node.loc.operator, ' ' * (aligned_column - column)
      end
    end
  end
end
{% endcodeblock %}

So... does it work?

```
$ ruby-rewrite --load align_eq.rb -e $'@definition = defn\nsource = "foo"\nunrelated(:method_call)'
@definition = defn
source      = "foo"
unrelated(:method_call)
```

Don't. Just don't
-----------------

What about removing superfluous (or adding missing, depending on your taste) `do`s and `then`s?

{% codeblock undo.rb lang:ruby %}
class Undo < Parser::Rewriter
  def on_while(node)
    remove_delimiter(node, 'do')
    super
  end

  def on_until(node)
    remove_delimiter(node, 'do')
    super
  end

  def on_if(node)
    remove_delimiter(node, 'then')
    super
  end

  def remove_delimiter(node, delimiter)
    if node.loc.begin && node.loc.begin.is?(delimiter)
      remove node.loc.begin
    end
  end
end
{% endcodeblock %}

Does it work?

```
$ ruby-rewrite --load undo.rb -e $'if foo then\n  bar\nend'
if foo
  bar
end

$ ruby-rewrite --load undo.rb -e $'if foo then\n  while bar do\n    baz\n  end\nend'
if foo
  while bar
    baz
  end
end
```

But what if I feed it something _insidious_? Will it start acting _evil_ and break my code? \*maniacal laughter\*

```
$ ruby-rewrite --load undo.rb -e $'if foo then bar; baz end'
ASTs do not match:
--- (fragment:0)
+++ (fragment:0)|after Undo
@@ -1,5 +1,4 @@
 (if
-  (send nil :foo)
-  (begin
-    (send nil :bar)
-    (send nil :baz)) nil)
+  (send nil :foo
+    (send nil :bar))
+  (send nil :baz) nil)
```

Nope! Feel safe out there, and explore the possibilities: they are endless.

(Oh, and if you're curious and want to fix the `Undo` rewriter: here, you'll need this: `bodies.compact.none? { |body| body.loc.line == condition.loc.line }`. I'll leave it as homework.)
