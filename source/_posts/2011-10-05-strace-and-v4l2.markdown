---
layout: post
title: "strace and V4L2"
date: 2011-10-05 03:50
comments: true
categories:
 - hardware
 - software
 - linux
---

Let's suppose you have a webcam which works with Skype, but does not with your
V4L2 code. You start Skype under `strace`... and suddenly discover that it does
not know any of the V4L2 ioctl's and shows them like this:

    ioctl(117, VIDIOC_S_PARM or VIDIOC_S_PARM_OLD, 0xb1025024) = 0

That's not very useful. If only you could get something like this...

    ioctl(117, VIDIOC_S_PARM or VIDIOC_S_PARM_OLD, {type=V4L2_BUF_TYPE_VIDEO_CAPTURE, capability=V4L2_CAP_TIMEPERFRAME, capturemode=0, timeperframe={numerator=1, denominator=30}, extendedmode=0, readbuffers=0}) = 0

Sure you can. Just grab [the patch](https://gist.github.com/1263207) against
strace 4.6 source, apply it, compile (don't forget `autoreconf -i`) and rejoice.
