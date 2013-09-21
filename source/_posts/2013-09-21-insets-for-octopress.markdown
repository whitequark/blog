---
layout: post
title: "Insets for Octopress"
date: 2013-09-21 14:40
comments: true
categories:
  - software
  - ruby
---

When I've been adding errata to [my Ruby Hacking Guide translation](/blog/2013/04/01/ruby-hacking-guide-ch-11-finite-state-lexer/), I wanted to format it as insets. Since there wasn't an implementation already, I wrote my own. Here is how it looks like:

{% inset I'm an inset! %}
I contain some interesting remarks about the <em>text</em>.
{% endinset %}

<!--more-->

The corresponding source would be:

{% codeblock %}{% raw %}
{% inset I'm an inset! %}
I contain some interesting remarks about the <em>text</em>.
{% endinset %}
{% endraw %}{% endcodeblock %}

Note that you have to write HTML inside the inset. Unfortunately, there is no portable way to make various Markdown converters supported by Octopress parse contents of block-level tags as Markdown.

To use it, you need to add two files to your Octopress source tree, and append `@import "insets";` to `sass/custom/_styles.scss`.

{% codeblock plugins/inset.rb %}
module Jekyll
  class Inset < Liquid::Block
    def initialize(tag_name, markup, tokens)
      super

      @title = markup.strip
    end

    def render(context)
      %Q{<div class="inset"><h4>#{@title}</h4><p>#{super}</p></div>}
    end
  end
end

Liquid::Template.register_tag('inset', Jekyll::Inset)
{% endcodeblock %}

{% codeblock sass/custom/_insets.scss %}
.inset {
  ul, ol {
    margin-left: 1.3em;
  }

  background: $base03 $noise-bg;
  border-top: 2px solid darken($base03, 4);
  border-bottom: 2px solid darken($base03, 4);

  margin-bottom: 0.5em;
  padding-top: 1.5em;

  margin-left: -$pad-min;
  margin-right: -$pad-min;
  padding-left: $pad-min;
  padding-right: $pad-min;
  @media only screen and (min-width: 480px) {
    margin-left: -$pad-narrow;
    margin-right: -$pad-narrow;
    padding-left: $pad-narrow;
    padding-right: $pad-narrow;
  }
  @media only screen and (min-width: 768px) {
    margin-left: -$pad-medium;
    margin-right: -$pad-medium;
    padding-left: $pad-medium;
    padding-right: $pad-medium;
  }
  @media only screen and (min-width: 992px) {
    margin-left: -$pad-wide;
    margin-right: -$pad-wide;
    padding-left: $pad-wide;
    padding-right: $pad-wide;
  }
}
{% endcodeblock %}
