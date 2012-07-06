---
layout: post
title: "Let's destroy Flash together"
date: 2012-07-06 07:23
comments: true
categories:
 - flash
 - software
---

{% img right /images/destroy-flash/no_flash.png No Flash, Please %}

Adobe Flash is obsolete. It is a proprietary technology controlled by a single company, it has hundreds of [gaping security holes](http://web.nvd.nist.gov/view/vuln/search-results?query=flash&search_type=all&cves=on), it [drains battery like crazy](http://www.pcworld.com/article/209856/dump_flash_get_2_extra_hours_of_macbook_air_battery_life.html), it is not supported anymore on mobile devices ([Apple](http://www.apple.com/hotnews/thoughts-on-flash/), [Google](http://www.theverge.com/2012/6/29/3125219/flash-mobile-android-4-1-not-supported) and [Microsoft](http://www.macobserver.com/tmo/article/microsoft_outlaws_flash_on_touch-interface_ie_10/)) and [Linux](http://www.omgubuntu.co.uk/2012/02/adobe-adandons-flash-on-linux). Even Adobe themselves think that Flash [should die](http://blogs.adobe.com/conversations/2011/11/flash-focus.html); let's help them to weed the garden!

Quite a few people are still relying on Flash for publishing dynamic content. One of their reasons is, apparently, the possibility of code protection ([1](http://www.beancreative.com/blog/client/index.cfm/2012/3/15/The-peril-of-HTML5-Do-you-really-want-to-share-your-private-proprietary-code-with-the-public), [2](http://weareorganizedchaos.com/index.php/2010/03/18/html5_vs_flash/), [3](http://www.pseudocoder.com/blog/why-html5-video-wont-replace-flash), [4](http://blog.authorstream.com/2012/04/html5-or-flash-which-one-is-better-to.html), etc.) This is plain wrong: there is **no viable code protection** in Flash. I'm going to prove this once and for all.

<!-- more -->

The Problem
-----------

Pretty much the only viable alternative to Flash is HTML5. It's an evolving open standard, and it already has all of the features which made it possible for Flash to dominate the market for more than a decade. As a consequence of being an open standard, HTML5 does not have a way to protect code and assets of your application.

Sure, you can obfuscate your code...

{% img center /images/destroy-flash/obf-before.png Obfuscated code %}

... but if you're running a browser like Chrome, you are one mouse click away from making it (kind of) readable again:

{% img center /images/destroy-flash/obf-after.png Not so obfuscated code %}

What's the primary market for Flash obfuscators, cryptors and protectors? Online games, and especially online multiplayer games. A lot of developers think that if they hide the internals good enough, and maybe also encrypt the protocol, then cheat and bot authors won't understand how it works, and so the developers don't implement any sensible security measures at all. In other words, they employ [security through obscurity](http://en.wikipedia.org/wiki/Security_through_obscurity).

In reality, surpassing such countermeasures takes significantly *less* time than to create them.

The Plan
--------

I have already written an advanced ActionScript 3 [analysis toolkit](http://github.com/whitequark/furnace-avm2) which includes a decompiler, a rudimentary deobfuscator ([26 lines](https://github.com/whitequark/furnace-avm2/blob/master/lib/furnace-avm2/abc/primitives/opcode_sequence.rb#L146) of code are enough to bypass some commercial solutions) and a framework which can, for example, automatically dissect things as complex as polymorphic encrypted loaders. It's also highly modular and extensible.

**I challenge everyone to present a Flash protector I could not circumvent.** Every week I would pick one application and implement a module which reverses whichever modifications it has made to the code to make it unreadable, then release it publicly along with a description in a blog entry. Flash protectors are already useless; this should make it obvious.

Ultimately I want to wipe the entire market of protectors and obfuscators.

But I like Flash!
-----------------

Chances are that you're a Flash developer. Please, do everyone a favor and learn a *good* piece of technology. You will also benefit from being able to find a new job after your current one vanishes in a year or so.

Oh, you also wrote an obfuscator? Stop selling snake oil.

OMG YOU'RE SO BAD ARTISTS WILL BE RUINED
----------------------------------------

Jane is an IT security specialist. She finds a bug (like [this](http://web.nvd.nist.gov/view/vuln/detail?vulnId=CVE-2012-2039)) in a common piece of software which allows anyone to execute arbitrary code on your computer. (Behind the word "arbitrary" most often hides a trojan horse which steals your credit card number or something similarly vicious.) What could she do?

First, she could keep it for herself or sell it to a malware author. This will leave her with a huge sum of money, very bad karma and, possibly, a conviction.

Second, she could *disclose* it: release some or all information about the bug to general public. This will allow software author to fix the bug and everyone else to check if their system is vulnerable (so-called *penetration testing*). She could also report it to the vendor first and wait for a month or so to allow them to fix the bug, if she wants. Immediate release can be a bit controversional, but is [generally accepted](http://en.wikipedia.org/wiki/Full_disclosure) too.

There's even an open-source project dedicated to penetration testing, [Metasploit](http://metasploit.com). It has exploits for thousands of security holes, some still unfixed for lots of systems, and hardly requires a brain to use. Nevertheless, it's a mature and well-respected system used by a lot of people and companies across the world.

Absence of public information about deficiences, may them be security holes or false claims, is not going to create any obstacles for those who want to exploit these deficiences. But it does create a false sense of security.

You're an evil greedy bastard anyway
------------------------------------

I have released Furnace::AVM2 under a permissive MIT license. Basically that means that you have a right to rename the project whatever you like then sell it for $500/copy without even notifying me. (The only thing you cannot do is to pretend that you wrote it instead of me). All of the deobfuscation modules will be released under the same license, too.

A note on submissions
---------------------

I would prefer to receive .swf files for analysis rather than obfuscators. First, obfuscators can have restrictive licensing terms and three digit price tags; some of them might even be unavailable for general public. Second, chances that most of them won't run on Linux, which I use for my work.

As a single obfuscator might be using various protection techniques, it would be helpful to get several different samples; even more so if it has different protection levels.

Of course, you should not send me copyrighted .swf's or do anything similarly illegal.

I won't accept any legacy ActionScript 2 submissions. I don't have analysis infrastructure for that format, and it's not worth developing anyway, as it was deprecated long time ago and isn't used much these days.

{% img center /images/destroy-flash/trash.png %}