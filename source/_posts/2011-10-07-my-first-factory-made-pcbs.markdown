---
layout: post
title: "My first factory-made PCBs"
date: 2011-10-07 21:31
comments: true
categories:
 - hardware
---

Today, my first batch of PCBs made on a real factory has arrived.

<!--more-->

![Gerber files](/images/tft-lvds/gerber.png)
[![Real PCBs](/images/tft-lvds/pcbs-small.jpeg)](/images/tft-lvds/pcbs.jpeg)

I'll describe the purpose, functionality and process of making the boards after components will arrive; that will probably happen in roughly two weeks.

The sources are released under [WTFPL](http://sam.zoy.org/wtfpl/COPYING): [tft-lvds.tbz2](/downloads/tft-lvds.tbz2).

The Eagle [library](/downloads/lvds.lbr) for [National DS90C363 chip](www.national.com/pf/DS/DS90C363.html) and
[Hirose DF20G-40DP connector](http://www.hirose-connectors.com/connectors/H205SeriesGaiyou.aspx?c1=DF20&c3=3)
is released to the public domain.

**27 Jan 2012 update:** the boards have arrived and I've assembled them, but they have some nasty crosstalk bugs and
are unfortunately unusable. **DO NOT USE THIS DESIGN.** I'll try fixing them once I'll get access to a >100MHz scope.

The footprints in library are verified and correct, through.