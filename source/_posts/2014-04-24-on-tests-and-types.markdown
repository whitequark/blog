---
layout: post
title: "On tests and types"
date: 2014-04-24 11:44
comments: false
categories:
  - software
---

Much has been said on the virtues of testing and type systems. However, I say that neither of them ultimately matters. Your codebase could be pure PHP, using exclusively _goto_ for control flow, have no tests, comments, or variable names whatsoever--if you are rightfully sure that it is correct (for any possible input, produces valid output with limited use of resources), the codebase is perfect.

The big question, of course, is "how can we be sure that it is correct?" There have been impressive advances in the field of authomatic theorem proving, e.g. [Coq][] and [CompCert][]. Unfortunately, we neither able nor should put a scientist behind every menial programming job; even if we could, [undecidability][] means that we could only get a definite answer for a subset of interesting problems.

The only available option is to rely on human judgement. Any tools or methods a programmer would employ are only useful as long as they enable a deeper understanding of the program, as they rightfully convince her that the program is indeed correct. [If you don't make an error, don't test for it.][kbeck]

Invariably, people do not all think alike. There is no single way of reasoning about programs and their behavior; there could be no single technique that enables writing nicest possible code. Thinking that the way that suits you most is the superior of them all is just arrogance. We can do better than that.

I'm not saying that all languages and methods are born equal. They are not. But let's reason about them in terms of how easier they make it for a human to analyze the code, for it is the only thing that matters, and not peculiarities of syntax or the big names behind.

I'm also not saying that all code must be perfect. It doesn't matter if a few pixels in a cat picture have the wrong color. But you better be sure they do not get executed.

[coq]: http://coq.inria.fr/
[compcert]: http://compcert.inria.fr/
[undecidability]: http://en.wikipedia.org/wiki/Undecidable_problem
[kbeck]: http://stackoverflow.com/a/153565/254415
