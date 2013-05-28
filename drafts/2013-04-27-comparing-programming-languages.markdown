---
layout: post
title: "Comparing programming languages"
date: 2013-04-27 20:15
comments: true
categories:
  - software
---

Emerging programming languages are a hot topic these days; even when they weren't, holy wars between devotees of different languages unfolded for months. I attempt to summarize some valid, useful and hopefully non-inflammatory ways of comparing languages, and explain why some of the most common comparisons don't make much sense.

<!--more-->

What would constitute a meaningful comparison of PL?

Common case, edge case
----------------------

Let's start from an analogy. How would you compare relational databases? The most important properties of them are summarized as _ACID_: that is, atomicity, consistency, isolation and durability. To make a valid comparison, you would probably try to stress each of these properties: perform a lot of transactions in parallel, actively check consistency of both the stored and returned data, and отрубить off power at unexpected times.

On the other hand, you probably wouldn't just open a single connection and then INSERT some rows and SELECT them by their primary key.

How would you compare operating system kernels? You'd push them not just to *an* extreme--you would push them to *different* extremal conditions at the same time. Open a lot of files, perform a lot of I/O on them, add half a gigabit of inbound network traffic and schedule a CPU-bound, realtime process like video playback on top of all that. You'd also run a conformance test to ensure that all the APIs behave as advertised.

You most certainly would not run just a single process and have it read or write one big file. Even DOS can do that pretty well.

Please, stop comparing languages by performing simple common tasks. Everything can sum up two numbers. Even if someone actually needs to compute Fibonacci numbers, *by itself* it is not a meaningful benchmark: an actual workload will include I/O, memory allocation, garbage collection, JIT compiler activating at completely unexpected times...

[PHP parser vs Ruby parser?]

Performance
-----------

Afterword
---------

To summarize: compare edge cases; compare as least as possible; know your workload.

