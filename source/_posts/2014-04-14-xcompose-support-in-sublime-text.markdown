---
layout: post
title: "XCompose support in Sublime Text"
date: 2014-04-14 02:06
comments: true
categories:
  - software
---

[Sublime Text][st] is an awesome editor, and [XCompose][] is very convenient for
quickly typing weird Unicode characters. However, these two don't combine:
Sublime Text has an annoying bug which prevents the [xim][] input method, which
handles XCompose files, from working.

What to do? If Sublime Text was open-source, I'd make a patch. But it is not.
However, I still made a patch.

If you just want XCompose to work, then add the [sublime-imethod-fix PPA][ppa]
to your APT sources, install the `libsublime-text-3-xim-xcompose` package,
and restart Sublime Text. (That's it!) Or, [build from source][gh] if you're not
on Ubuntu.

[st]: http://sublimetext.com/
[xcompose]: https://wiki.edubuntu.org/ComposeKey
[ppa]: https://launchpad.net/~whitequark/+archive/sublime-imethod-fix
[gh]: https://github.com/whitequark/sublime-imethod-fix
[xim]: http://en.wikipedia.org/wiki/X_Input_Method

However, if you're interested in all the gory (and *extremely* boring) details,
with an occasional animated gif, read on.

<!--more-->

Hunting the bug
---------------

To describe the bug, I will first need to explain its natural environment. In Linux,
a desktop graphics stack consists of an X11 server and an application using the Xlib
library for drawing the windows and handling user input. When it was conceived,
a top-notch UI looked like this:

{% img center http://upload.wikimedia.org/wikipedia/commons/5/58/Plan_Open_Motif_screenshot.png %}

The X11 protocol and Xlib library are quite high-level: originally, you were expected
to send compact, high-level instructions over the wire (such as "fill a rectangle
at (x,y,x',y')") in order to support thin clients over slow networks. However,
thin clients and mainframes vanished, and in their place came a craving for beautiful
user interfaces; and X11 protocol, primitive as it is, draws everything as if it came
from 1993. (It is also worth noting that X went from X1 to X11 in three years, and
has not changed since then.)

The Compose key and XCompose files are a remnant of that era. Xlib has a notion of
*input method*; that is, you would feed raw keypresses (i.e. the coordinates of
keys on the keyboard) to Xlib and it would return you whole characters. This ranged
from extremely simple US input method (mapping keys to characters 1:1) to more
complex input methods for European languages (using a dedicated key to produce
composite characters like é and ç) to very intricate Chinese and Japanese input
methods with complex mappings between Latin input and ideographic output.

Modern GUI toolkits like GTK and Qt ignore the X11 protocol almost entirely. The only
drawing operation in use is "transfer this image and slap it over a rectangular area"
(which isn't even present in the original X11 protocol). Similarly, they pretty
much ignore the X input method, favoring more modern [scim][] and [uim][].

[scim]: http://en.wikipedia.org/wiki/Smart_Common_Input_Method
[uim]: https://code.google.com/p/uim/

XCompose is probably the only useful part of the whole X11 stack. Unfortunately,
native XCompose support is not present anywhere except the original X input method.
Fortunately, both GTK and Qt allow changing their input method to XIM. Unfortunately,
Sublime Text somehow ignored the X input method completely even when instructed to
use it.

Sublime Text draws its own UI entirely to make it look nice on all the platforms.
As such, on Linux it has three layers of indirection: first its own GUI toolkit,
then GTK, which it uses to avoid dealing with the horror of X11, then X11 itself.

The Xlib interface for communicating with the input method is pretty simple:
it's just the [XmbLookupString][] function. You would feed it the
[XPressedKeyEvent][]s containing key codes that you receive from the X11
server, and it would give back a string, possibly empty, with the sequence
of characters you need to insert in your text area. Also, in order to
start communicating, you need to initialize an X input context corresponding
to a particular X window. (An X window is what you'd call a window, but also
what you'd call a widget--say, a button has its own X11 window.)

[xmblookupstring]: http://linux.die.net/man/3/xmblookupstring
[xpressedkeyevent]: http://linux.die.net/man/3/xkeyevent

GTK packs the input method communication logic in
the [gtk_im_context_xim_filter_keypress][] function it has in its wrapper
around the X input method. From there, it's a pretty deep hole:

  * [gtk_im_context_xim_filter_keypress][] uses a helper [gtk_im_context_xim_get_ic][]
    to get the X input context, and if no context is returned, it resorts to
    a trivial US keymap;
  * [gtk_im_context_xim_get_ic][] pulls the X input method handle and associated GTK
    settings from the `((GtkIMContextXIM *)context_xim)->im_info` field;
  * which is initialized by the [set_ic_client_window][] helper;
  * which refuses to initialize it if `((GtkIMContextXIM *)context_xim)->client_window` is `NULL`;
  * which is called (through one more layer of indirection used by GTK to change
    the input methods on the fly) by Sublime Text itself;
  * which passes `NULL` as the `client_window`.

Now, why does that happen? Sublime Text calls [gtk_im_context_set_client_window][] (the helper that
eventually delegates to [set_ic_client_window][]) in a snippet of code which looks roughly
like this:

{% codeblock lang:c %}
void sublimetext::gtk2::initialize() {
  // snip
  GtkWindow *window = gtk_window_new ();
  // a bit more initialization
  GtkIMContext *context = gtk_im_multicontext_new ();
  gtk_im_context_set_client_window(GTK_IM_CONTEXT(context), window->bin.container.widget.window);
  // snip
}
{% endcodeblock %}

What is that `window->bin.container.widget.window`? It contains the G<em>d</em>kWindow
of the G<em>t</em>kWindow; Sublime Text has to fetch it to pass to
[gtk_im_context_set_client_window][], which wants a [GdkWindow][].

What is a [GdkWindow][]? It's a structure used by GTK to wrap X11 windows on Linux and
other native structures on the rest of platforms. As such, if the [GdkWindow][] and
its underlying X11 window are not yet created, say, because these windows were yet
never shown, the field would contain `NULL`. And since Sublime Text attempts to bind
the IM context to the window immediately after creating the latter, this is exactly
the bug which we observe.

It is worth noting that while no input methods that require the window to be know work,
a simple GTK fallback that queries the system for the key configured as Compose key, but
uses internally defined tables with commonly used sequences, does. This is why if you
launch Sublime Text as `GTK_IM_METHOD=whatever-really subl` allows you to enter
° with `<Multi_key> <o> <o>`, but not customize it by changing any of the XCompose files.

[gtk_im_context_xim_filter_keypress]: https://git.gnome.org/browse/gtk+/tree/modules/input/gtkimcontextxim.c?id=2.24.20#n687
[gtk_im_context_xim_get_ic]: https://git.gnome.org/browse/gtk+/tree/modules/input/gtkimcontextxim.c?id=2.24.20#n1389
[set_ic_client_window]: https://git.gnome.org/browse/gtk+/tree/modules/input/gtkimcontextxim.c?id=2.24.20#n616
[gtk_im_context_set_client_window]: https://developer.gnome.org/gtk3/stable/GtkIMContext.html#gtk-im-context-set-client-window
[GdkWindow]: https://developer.gnome.org/gdk3/stable/gdk3-Windows.html

Cooking the meat
----------------

How do we fix this? I started with a simple [gdb script][]:

{% codeblock %}
# Run as: $ GTK_IM_MODULE=xim gdb -script fix-xcompose-sublime-text-3061.gdb
file /opt/sublime_text/sublime_text
set follow-fork-mode child
set detach-on-fork off
run
inferior 2
set follow-fork-mode parent
set detach-on-fork on

b *0x5b3267
c
del 1
set $multicontext = (GtkIMMulticontext*) $r13
set $window = (GtkWindow*) $rbx

b gtk_widget_show if widget==$window
c
fin
del 2

call gtk_im_context_set_client_window($multicontext,$window->bin.container.widget.window)
detach inferiors 1 2
quit
{% endcodeblock %}

On a high level, the script does four things:

  1. Sublime Text forks at startup, so the script has to do a little funny dance
     to attach gdb to the correct process.
  2. Then, it stops at the point in the initialization sequence where my Sublime Text
     build calls [gtk_im_context_set_client_window][], and captures the `window`
     and `multicontext` variables, which the compiler happened to leave around in
     spare registers.
  3. Then, it waits until GTK surely initializes a GdkWindow for the `window` [GtkWindow][].
  4. Then, it calls [gtk_im_context_set_client_window][] again, exactly as Sublime Text
     would, but at the right time.

The script works. However, it is slow at startup and not very convenient in general.
In particular, I would have to rewrite it every time Sublime Text updates. So, I opted
for a better approach.

[LD_PRELOAD][] (see also tutorial: [1][preload tut1], [2][preload tut2]) is a convenient
feature of Linux [dynamic linker][] which allows to substitute some functions contained
in a shared library with different functions contained in another shared library. This is
how, for example, [fakeroot][] performs its magic.

Initially I wanted to intercept [gtk_window_new][] and [gtk_im_multicontext_new][]
to get the [GtkIMMulticontext][] and the [GtkWindow][] Sublime Text creates--they're
the first ever created--and then [gtk_im_context_filter_keypress][] to call
[gtk_im_context_set_client_window][] before the first keypress is handled. But, somehow
these calls were not intercepted by [LD_PRELOAD][]; perhaps a weird way Sublime Text
calls [dlsym][]? I never figured it out.

So, eventually I settled on intercepting the initialization of the GTK XIM input method
plugin (which is loaded by GTK itself and therefore can be intercepted easily)
and replacing its [filter_keypress][xim_filter_keypress] handler with my own.
A [filter_keypress][xim_filter_keypress] handler receives a [GtkIMContext][]
and a [GdkEvent][], which contains the pointer to [GdkWindow][], so that would
give me all the information I need.

[That worked][library].

[gdb script]: https://sourceware.org/gdb/onlinedocs/gdb/Command-Files.html
[ld_preload]: http://man7.org/linux/man-pages/man8/ld.so.8.html
[preload tut1]: http://www.catonmat.net/blog/simple-ld-preload-tutorial/
[preload tut2]: http://www.catonmat.net/blog/simple-ld-preload-tutorial-part-2/
[dynamic linker]: http://en.wikipedia.org/wiki/Dynamic_linker#ELF-based_Unix-like_systems
[fakeroot]: http://man.he.net/man1/fakeroot
[dlsym]: http://pubs.opengroup.org/onlinepubs/009695399/functions/dlsym.html
[xim_filter_keypress]: https://git.gnome.org/browse/gtk+/tree/modules/input/gtkimcontextxim.c?id=2.24.20#n534
[library]: https://github.com/whitequark/sublime-imethod-fix/blob/master/libsublime_text-xim-xcompose.c
[GtkWindow]: https://developer.gnome.org/gtk3/3.5/GtkWindow.html
[gtk_window_new]: https://developer.gnome.org/gtk3/stable/GtkWindow.html#gtk-window-new
[GtkIMMulticontext]: https://developer.gnome.org/gtk3/stable/GtkIMMulticontext.html
[gtk_im_multicontext_new]: https://developer.gnome.org/gtk3/stable/GtkIMMulticontext.html#gtk-im-multicontext-new
[gtk_im_context_filter_keypress]: https://developer.gnome.org/gtk3/3.0/GtkIMContext.html#gtk-im-context-filter-keypress
[GtkIMContext]: https://developer.gnome.org/gtk3/stable/GtkIMContext.html
[GdkEvent]: https://developer.gnome.org/gdk3/stable/gdk3-Event-Structures.html#GdkEventAny

Celebrating the game
--------------------

Indeed, the goal was achieved in full. It only took me about ten hours, with practically
no prior knowledge of libx11 or libgtk internals, access to Sublime Text source, or
experience in reverse engineering.

But what was this for? I don't think I ever *needed* to type ಠ_ಠ in Sublime Text.

I think I just like the sense of control over my tools.

{% img center /images/sublime-win.gif %}
