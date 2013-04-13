---
layout: post
title: "Unmentioned features of Ruby 2.0"
date: 2013-04-14 01:47
comments: true
categories:
  - software
  - ruby
  - insanity
---

It has been a while since the release of Ruby 2.0, and a lot of comprehensive guides to the new 2.0 features were written. However, I feel that some of them are still left in obscurity. The justice shall be served.

<!--more-->

## All constants now support ||= and &&=

This one is pretty sad. In Ruby 1.8 and 1.9, constants behaved just like variables... yes, I just said that. Sigh. Also, not all of them:
```
>> A = nil; A ||= 1; p A
-e:1: warning: already initialized constant A
1
>> A = 1; A += 1; p A
-e:1: warning: already initialized constant A
2
>> ::B ||= 1
-e:1: constant re-assignment
```

Note that in the last case, the constant was not even defined before.

However, Ruby 2.0 allows us to use them freely:
```
>> ::A ||= 1; p A
1
```

Please, do not use this, ever, in your code.

## Better disambiguation of symbols and hash labels

In Ruby 1.9, the following code has a syntactic error:
```
>> if false; else p:bar end
-e:1: syntax error, unexpected tLABEL
if false; else p:bar end
                 ^
```

However, Ruby 2.0 parses it:
```
>> if false; else p:bar end
:bar
=> :bar
```

Please, do not take advantage of this in your code.

## BEGIN{} now displays proper error message when used within a method body

Ruby 1.8:
```
>> def f; BEGIN{}; end
-e:1: BEGIN in method
def f; BEGIN{}; end
            ^
```

Ruby 1.9:
```
>> def f; BEGIN{}; end
-e:1: syntax error, unexpected keyword_BEGIN
def f; BEGIN{}; end
            ^
```

Ruby 2.0:
```
-e:1: BEGIN is permitted only at toplevel
def f; BEGIN{}; end
            ^
```

Please, do not write code that depends on this, or uses `BEGIN` at all. (... do you notice a pattern?)

## I have no idea what to write in this heading

Ruby 1.9:
```
>> m () {}
-e:1: syntax error, unexpected ')'
m () {}
    ^
```

Ruby 2.0:
```
>> p () {}
nil
```

If you want to use this, you should consult your assigned therapist. What do you mean you don't have one? Well, you will need assistance anyway after you finish reading this post.

## Block argument declarations can now span multiple lines

Ruby 1.9:
```
>> m { |a
;b| }
-:1: syntax error, unexpected '\n', expecting '|'
```

Ruby 2.0:
```
>> p { |a
;b| }
nil
```

This one is pretty nice actually. I needed it yesterday; what a nice way to justify installing 2.0.0-p0 on production to our ops team!

## 4220

Um... if you get this and do it like that, and then pick a square peg and push it through a hexagonal hole... or actually it's all the other way around, but it doesn't matter much?

Ruby 1.9:
```
>> p begin 1.times do 1 end end
-e:1: syntax error, unexpected keyword_do_block, expecting keyword_end
                  ^
```

Ruby 2.0:
```
p begin 1.times do 1 end end
1
=> 1
```

## But why?!

What is this and do you Evan? I mean, do you break even? Break something?.. Get it? I neither.

A question I'm not going to answer. However, if you'd ask *how*... lo and behold, thou shalt useth a mighty [diff](http://rxr.whitequark.org/mri/diff/parse.y?v=2.0.0-p0;diffval=1.9.3-p362;diffvar=v).

Also, who is Evan? You tell me!
