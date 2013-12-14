---
layout: post
title: "The Next Web"
date: 2013-06-10 20:19
comments: true
categories:
  - software
---

The Web has grown out of JavaScript, HTML, CSS and HTTP. It is evident that the whole technological stack must change, yet the direction is unclear. In this post I present a few draft ideas for a next generation of web browsers.

<!--more-->

Sketchbook
----------

First, what are our requirements for such application? In no particular order:

 * Isolation. websites owned by different entities (such ownership can be mediated by, for example, _same-origin policy_) must not be able to affect (or just detect) operation of each other.
 * User interface confinement. There must exist a clear delineation between user interface of a website and any chrome of the web browser itself.
 * Machine interface confinement. A website must not be able to perform any externally visible operation unsupervised.
 * Mandatory independence of extrinsic details of the platform. For example, all three major OSes have their own ways of, on low level, performing system calls; on high level, traversing filesystem or displaying graphics. A generic interface can unify these OS-specific details well enough to be practical.
 * Optional dependency on intrinsic details of the underlying platform. For example, modern CPUs almost always have SIMD instructions, and it is desirable for applications to be able to take advantage of them. However, no generic interface can unify intrinsic machine-specific details without compromising efficiency to the point where relying on such details is no longer profitable.
 * Extensibility. It should be possible and easy to provide support for non-standard hardware features, including those which will not be standardized.
 * Interoperability. websites which belong to the same browser must be able to communicate without any external servers, or WAN availability for that matter.
 * Backwards compatibility with HTML, CSS, etc.

In particular, it is important that the proposed technology should *reduce* the amount of layers of abstraction lying between the machine and the website, not increase it. It is intentionally not based on, derived from, or in any way related to existing technology stack.

My proposal for implementing a technology which satisfies each of the requirements is described below.

### Isolation

Each website operates in a hardware-assisted sandbox. Such sandbox may be implemented with virtual memory on top of existing operating systems, as it is done in Chromium, but a more desirable solution would be to employ hardware virtualization capabilities. For example, hardware virtualization is *composable*, i.e. a web browser can run inside a web browser, whereas virtual memory sandboxes are not.

In such sandbox, an interface to the web browser is provided. This interface is based on the principle of whitelisting, i.e. everything which is not expressly permitted is prohibited. Code whcih executes in the sandbox cannot access anything except the memory it owns and this interface.

Such interface may be implemented by providing a set of functions compliant with the C ABI at predefined memory locations. In the case of an OS-based sandbox, communication with the web browser can happen via shared memory and kernel synchronization primitives, whereas in a virtualized sandbox an elegant solution is to employ hypervisor calls.

Both virtual memory based sandboxes and virtualization based sandboxes are widely used in the industry and provide an excellent level of isolation, if implemented correctly.

### User interface confinement

Each website receives an OpenGL ES context, which it can use to draw its user interface. OpenGL ES is a widely supported variant of OpenGL; it can be used to provide support for both PCs and mobile devices.

Existing environments gradually shift towards rendering their UI with GPU-based compositing; some examples include Android (version 4 or later), Wayland, Mir, Windows (with Aero enabled) and OS X (Quartz). This enhances battery life for mobile devices (GPUs are ubiquitous and even a simplistic GPU is much more efficient at manipulating high-resolution graphics than a CPU), UI responsiveness (important for touch-controlled devices), reduces platform dependency (no need to implement distinct backends for X11, GDI, Quartz, etc.), and, again, allows for composition (OpenGL contexts can be arbitrarily nested).

For legacy platforms which do not support any kind of OpenGL, an emulated solution can be provided, such as LLVMpipe. It is also possible to translate OpenGL calls to a different interface, such as DirectX, using existing open-source solutions.

An OpenGL context can be used to restrict drawing operations only to a certain part of the display surface, thus achieving UI confinement.

### Machine interface confinement

Machine interface confinement is already achieved by allowing the browser to monitor and potentially deny any action a website may try to perform.

### Extrinsic details of the platform

Extrinsic details of the platform, such as particular ways of initializing graphics contexts, persisting data, managing processes, performing network operations and so on, are abstracted by the browser, which only presents an unified interface.

### Intrinsic details of the platform

Intrinsic details of the platform, such as word width, CPU architecture, SIMD operations, hardware multimedia processors and so on, are not abstracted away but presented to the website as is. In other words, the browser first and foremost provides an execution environment for _native code_.

The approach for providing access to hardware capabilities is twofold

 * Some of the features, such as SIMD operations, can be accessed simply due to the fact that arbitrary native code can be executed.
 * Other, usually more complex features, such as multimedia processors, may require complex, potentially proprietary drivers, and/or be shared between multiple websites. In this case, the browser presents an interface for such a feature in the usual way.

See also the next section.

### Extensibility

Inventions happen every day. A vendor should not be forced through the standardization process in order to introduce a new feature. So, a common interface must exist for enumerating optional, possibly non-standard features.

It is expected that the extensibility mechanism will be primarily used to provide access to hardware: receiving GPS coordinates, reading the state of various sensors (accelerometers, gyroscopes, barometers), and so on. Higher-level features should be implemented within the common interface.

### Interoperability

A subset of BSD/POSIX-like socket API is provided in all sandboxes. This API achieves several goals:

 * Unrestricted communication with the entire Internet (not just the Web), without confinement to a particular protocol.
 * Local communication between different websites, or websites and components of the browser. For example, access to the filesystem of a host OS can be provided by a RESTful HTTP service written in Go and running in a privileged sandbox. Using sockets for this kind of communication provides the safest and simplest variant of isolation; additionally, it allows to reuse as much common components as possible.

### Backwards compatibility

With all the features above implemented, it is trivial to run an instance of extant web browser engine in one of the sandboxes; it will immediately provide backwards compatibility with all existing code.

As a particular case, one could run a web browser engine with an alternative scripting language, such as Decaf (Ruby).

Questions?
----------

This article is not a solid technical proposal and is not meant to be one. Rather, it is an invitation for a discussion of how the Web could possibly evolve.

