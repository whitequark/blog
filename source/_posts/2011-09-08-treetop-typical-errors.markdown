---
layout: post
title: "Treetop: Typical Errors"
date: 2011-09-08 00:41
comments: true
categories:
  - software
  - ruby
---

[Treetop][] is a [<abbr title="Parsing expression grammar">PEG</abbr>][peg] parser generator for Ruby which is very flexible and allows to create <abbr title="Domain Specific Language">DSL</abbr>'s in minutes, but it may be hard to understand for a newcomer.
<!--more-->

Examples in this article were checked on Treetop v1.4.10.

  [treetop]: http://treetop.rubyforge.org/
  [peg]: http://en.wikipedia.org/wiki/Parser_expression_grammar

Grammar tricks
--------------

First of all, parser expression grammars are always greedy. This is probably the most frustrating and unintuitive aspect of PEG's. Consider this grammar:

{% codeblock Incorrect grammar %}
grammar Example1
  rule string
    '"' .* '"'
  end
end
{% endcodeblock %}

The `string` rule is expected to parse double-quoted strings; it is woefully incorrect, through. The `.*` predicate will match *any* character, including a double quote, and the parser will never reach the end of the rule.

To fix the error, we can exclude the quote from the possible characters (replacing `.*` with something like `[^"]*`), but a cleaner and more flexible approach exists. We can instruct the parser to fetch one more token from the input stream and verify that it does not end the string; this is called *negative lookahead*. Here is the fixed rule:

{% codeblock Working grammar %}
grammar Example2
  rule string
    '"' ( !'"' . )* '"'
  end
end
{% endcodeblock %}

To allow representing double quotes inside our strings, escape characters are required. It may seem obvious to add a second choice to the list of characters like this:

{% codeblock Never matches \" %}
grammar Example3
  rule string
    '"' ( !'"' . / '\"' )* '"'
  end
end
{% endcodeblock %}

This is incorrect as well. `.`, being greedy (as any other PEG predicate is), will consume the backslash, and the second choice will never be taken. In order to work as expected, variants must be ordered from the narrowest to broadest one. Compare with the fixed code:

{% codeblock Knows what \"a\\\"b\" is %}
grammar Example4
  rule string
    '"' ( !'"' '\"' \ . )* '"'
  end
end
{% endcodeblock %}

Note that the negative lookahead predicate stays at its place. It does not belong to either of the variants, but rather to the group itself.

AST quirks
----------

Sometimes Treetop embeds some AST nodes into another nodes when you do not expect this. For example, let's look at this excerpt from one of my grammars:

{% gist 1201762 ast_quirks.treetop %}
{% gist 1201762 ast_quirks.rb %}

The `expression` rule may look a bit strange as-is, but it is actually just the last part of more complex code generation rule which included unary and binary operators, and a dozen of simple types in one list at end. If executed, `ast_quirks.rb` will display a thrown exception: <code>(eval):10:in 'to_code': undefined method 'to_code'</code>. But the method is indeed defined!

Somehow Treetop embeds the `string` or `number` subtrees into the `expression` tree, losing the attached methods in process. To alter this behavior, a `1..1` repeat specifier may be attached: it does not change the meaning of the rule, but prevents AST squashing.

{% gist 1201762 ast_quirks_fixed.treetop %}

Useful snippets
---------------

### Fancy error reporting

This function will show the location of an error in [Clang][] or Java style.

``` ruby
    def parse(data)
      if data.respond_to? :read
        data = data.read
      end
    
      parser = ExampleParser.new
      ast = parser.parse data
      
      if ast
        ast.do_something_useful
      else
        parser.failure_reason =~ /^(Expected .+) after/m
        puts "#{$1.gsub("\n", '$NEWLINE')}:"
        puts data.lines.to_a[parser.failure_line - 1]
        puts "#{'~' * (parser.failure_column - 1)}^"
      end
    end
```

``` console
    $ ruby test.rb
    Expected one of >=, <=, <, >, ==, !=, *, /, +, -, $NEWLINE, ; at line 2, column 14 (byte 35):
      scope @type, = "nothing"
    ~~~~~~~~~~~~~^
```

  [clang]: http://clang.llvm.org/

### String unescaping

This is a modification of string parsing rule described above which adds support for arbitrary escaped characters.

{% codeblock escaped_string\.treetop %}
grammar EscapedString
  rule string
    '"' letters:( !'"' string_letter )* '"' {
      def fetch
        letters.elements.map { |el| el.elements.last.fetch }.join
      end
    }
  end

  rule string_letter
    '\\' char:["ntH] {
      def fetch
        case char.text_value
          when '"'; '"'
          when 'n'; "\n"
          when 't'; 9.chr
          when 'H'; "hello world"
        end
      end
    }
    /
    . {
      def fetch
        text_value
      end
    }
  end
end
{% endcodeblock %}

``` console
    $ irb
    ruby-1.9.2-p290 :001 > require 'treetop'
     => true 
    ruby-1.9.2-p290 :002 > Treetop.load 'escaped_string.treetop'
     => EscapedStringParser 
    ruby-1.9.2-p290 :003 > puts EscapedStringParser.new.parse(%q{"see:\t\t\H"}).fetch
    see:		hello world
     => nil 
```
