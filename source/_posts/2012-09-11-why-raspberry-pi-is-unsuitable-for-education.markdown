---
layout: post
title: "Why Raspberry Pi is unsuitable for education"
date: 2012-09-25 08:21
comments: true
categories:
 - hardware
---

Raspberry Pi was designed [for education](http://www.raspberrypi.org/about). As any popular product is bound to, Raspberry Pi has been criticized a lot ([Lateral Opinion](http://lateral.netmanagers.com.ar/weblog/posts/the-raspberry-pi-sucks.html) and [C&Y](http://www.computerandyou.net/2012/07/10-reasons-why-raspberry-pi-sucks/) are typical examples) for things like lack of a box, absence of supplied charger or even WiFi.

Seriously, since the [EU bill](http://europa.eu/rapid/pressReleasesAction.do?reference=IP/10/1776) everyone has a spare micro-USB charger, and kids have suitable boxes in abundance. Most importantly, these problems are _solvable_: you might need to buy an USB hub or dig through some old stuff to find a forgotten micro-SD card, but that's it.

<span class="pullquote-right" data-pullquote="Raspberry Pi is a black box tightly sealed with patents and protected by corporations">
Raspberry Pi has a much more fundamental flaw, which directly conflicts with its original goal: it is a black box tightly sealed with patents and protected by corporations. It isn't even remotely an open platform.
</span>

<!--more-->

Dig for the Root
----------------

Raspberry Pi is powered by a slightly aged ARM11 processor. From the technical point of view, ARM is a really great architecture, especially for embedded devices: it offers simple orthogonal instruction set, extensibility and low power consumption per MHz. Given that it's the [prevailing](http://en.wikipedia.org/wiki/ARM_Cortex-A#Features_and_applications) non-x86 architecture with more than 90% of CPUs of its class being ARMs, I have no problems understanding the decision to put an ARM core in such a device.

Unfortunately, from the legal point of view ARM is a nightmare. Speaking about the ARM cores themselves (as opposed to their implementations, <abbr title="System on Chip">SoC</abbr>s), the only paper that is relatively open is the [architecture reference manual](http://infocenter.arm.com/help/index.jsp), and only in the sense that you can _probably_ read it without risking being sued, and the complete PDF is only available to "registered ARM customers" anyway.

Most other resources are confidential, and require signing NDAs apart from a costly license agreement, which is not available for individuals at all. For example, ARM includes extensions for running Java applications codenamed [Jazelle][], and the lack of documentation for these extensions prevents any open-source Java VMs from using them and also gives ARM absolute control over the market of JVMs used on ARM processors.

  [Jazelle]: http://en.wikipedia.org/wiki/Jazelle

Of course, sources ([VHDL][] or [Verilog][] ones) of the ARM cores themselves are not accessible to general public, and therefore you cannot learn anything about the innards of the CPU. (CPU architects don't appear from thin air. No, really.) Even if you could write a compatible CPU core from scratch and without even looking at anything ever produced or written by ARM (the license agreement for the _reference manual_ explicitly prohibits you from designing a CPU core this way), you could never manufacture devices with that core due to patent restrictions, and in fact you could never share it with anyone, for the ARM lawyers to come in and send a DMCA takedown notice to you.

{% pullquote left %}
This has actually [happened before](http://opencores.org/articles,1004822682). {" ARM directly hinders students and hobbyists with its actions "}.
{% endpullquote %}

  [VHDL]: http://en.wikipedia.org/wiki/VHDL
  [Verilog]: http://en.wikipedia.org/wiki/Verilog

Open Door to Heaven
-------------------

There is actually a decent amount of more or less open architectures.

{% pullquote %}
[MIPS][] was developed at universities to be used both at classes and factories, and it still has some visible traction. It's royalty-free and {" anyone can create their MIPS core and then share or manufacture it "}. There is a lot of existing MIPS-based processor manufacturers ([Ingenic][], [Broadcom](http://www.broadcom.com/products/brands/MIPS) etc.) in the likely case that you don't want to make your processor from scratch.
{% endpullquote %}

To speak about open hardware, there's a thingy called [Ben NanoNote][] based on a MIPS processor. It's as open as possible and _somewhat_ usable, but very significantly lacks in hardware compared even to Raspberry Pi.

[OpenRISC][] is quite good and has decent toolchain and Linux support, but I'm not aware of any mass-produced silicon implementations of it.

[OpenSPARC][] is an awesome CPU, but it's a bit on heavyweight side of engineering. I'm not completely sure if an off-the-shelf embedded option is available, but I think it is.

MIPS is not patented (it may have proprietary implementations, but the architecture itself is free), and both OpenRISC and OpenSPARC are distributed under GNU GPL. The first and the last architecture could be used within Raspberry Pi, with MIPS being the easiest to implement.

{% pullquote left %}
To speak about all things open, {" not everyone in the industry behaves like ARM "}. [Atmel][], the author of AVR architecture, didn't release it as open source, but they always supplied complete documentation without strange legal clauses and never bothered to destroy their relations with hobbyists. AVR softcores are available in abundance ([an unnamed one](http://opencores.org/project,avr_core), [navre](http://opencores.org/project,navre), etc).
{% endpullquote %}

  [MIPS]: http://en.wikipedia.org/wiki/MIPS_architecture
  [OpenRISC]: http://en.wikipedia.org/wiki/OpenRISC
  [OpenSPARC]: http://en.wikipedia.org/wiki/OpenSPARC
  [Ben NanoNote]: http://en.qi-hardware.com/wiki/Ben_NanoNote
  [Ingenic]: http://en.wikipedia.org/wiki/Ingenic_Semiconductor
  [Atmel]: http://atmel.com/

The Complete Picture
--------------------

Up to this point, we only talked about the CPU core itself. But modern chips also contain lots of peripherals on the same die, and the whole complex is called System-on-Chip, or SoC. One of prominent vendors of SoCs is [Broadcom][], among with [Texas Instruments][], [ST Microelectronics][], and several others.

  [Broadcom]: http://broadcom.com/
  [Texas Instruments]: http://ti.com/
  [ST Microelectronics]: http://st.com/

Broadcom was never known as particularly open-source friendly company. Until recently, its Linux drivers for wireless cards were of [outstandingly bad quality](https://wiki.archlinux.org/index.php/Broadcom_wireless), contained pieces of binary code loaded into the kernel and were licensed in a way incompatible to including the drivers to the Linux mainline; additionally, Broadcom never released any documentation to help Linux developers to write alternative, completely open-source drivers. Fortunately, in 2010 they [finally released](http://thread.gmane.org/gmane.linux.kernel.wireless.general/55418) a proper open-source driver, but there is still no documentation available, and those drivers require a proprietary firmware which is licensed in a way which prohibits unlimited distribution. (For example, Debian installation CDs cannot make any use of Broadcom WLAN cards for that precise reason.)

<span class="pullquote-right" data-pullquote="The whole system cannot function without [...] a closed-source firmware">
It's even worse on Raspberry Pi. The Pi has a OpenGL-capable graphics processing unit, which by some strange coincidence is a required and vital component of the SoC. The whole system cannot function without the GPU as it's the first component to boot and controls some vital peripherals, and the GPU can only work with a closed-source firmware. Little is known about the architecture of GPU, and as Broadcom has no intent of releasing any further documentation, writing an open-source replacement isn't a realistic option. Modern GPU architectures are very complex, and in the best case one could (maybe) successfully boot the system with the most basic graphics possible. Proper 3D acceleration will never be.
</span>

3D acceleration drivers are just mockery. Not only they will only ever work for X and Android because that's what Broadcom wants to sell them for, but they're also completely closed-source even on the Linux part. The open-source kernel "driver" is basically a stub which does not perform anything except message passing between proprietary OpenGL driver and a proprietary GPU firmware.

{% pullquote left %}
With advent of [GPGPU][] and with various devices consisting mainly of giant screens increasingly filling our lives, {" learning to program GPUs has never been more important "}!
{% endpullquote %}

  [GPGPU]: http://en.wikipedia.org/wiki/GPGPU

Not only the GPU-related documentation or source code is nonexistent, but the datasheet for the SoC is available only as a [stripped down PDF](http://www.raspberrypi.org/faqs) which doesn't include enough information to boot the processor with your own code. Schematics for the Pi is not available either, and I see precisely no reasons for not distributing it openly. Raspberry Pi has nothing to do with open hardware.

Talking To the World
--------------------

For an educational electronics device it is extremely important to be interoperable with existing open and accessible standards. There are some widely known open standards like Wi-Fi, Ethernet or USB, but significantly simpler interfaces like [SPI][] and [I<sup>2</sup>C][I2C] are widely used; in fact, the simplest existing communication standard is [GPIO][], which is simply a single digital pin with either high or low digital level.

<span class="pullquote- %}" data-pullquote="you cannot simply plug in an Arduino, as you would damage your Pi">
Raspberry Pi indeed [supports](http://elinux.org/images/thumb/2/2a/GPIOs.png/254px-GPIOs.png) such interfaces, but with a very significant drawback: the voltage levels are [3.3V only][rpi-gpio] and are not 5V tolerant. This basically means that you cannot simply plug in a (5 volt) Arduino and call it a day; you would kill either that GPIO pin or your whole Pi. Worse, even if you will find an unofficial 3.3V Arduino, you could accidentally reverse the current flow direction on it and still damage the Pi.
</span>

  [SPI]: http://en.wikipedia.org/wiki/Serial_Peripheral_Interface_Bus
  [I2C]: http://en.wikipedia.org/wiki/I2C
  [GPIO]: http://en.wikipedia.org/wiki/GPIO
  [rpi-gpio]: http://elinux.org/RPi_Low-level_peripherals#General_Purpose_Input.2FOutput_.28GPIO.29

{% pullquote %}
The Pi contains just a few GPIO pins, seventeen to be precise. The solution to accidental over-voltage and over-current is simply adding a 200 Ohm resistor and a diode to each of the supplied pins. This is not expensive, nor does these components occupy a significant amount of PCB surface. The parts aren't expensive; without even trying to optimize cost, I could add 9x of these [diodes](http://www.digikey.com/product-detail/en/BAV70LT3G/BAV70LT3GOSCT-ND/2704938) and 3x of these [resistor arrays](http://www.digikey.com/product-detail/en/EXB-2HV221JV/Y1221TR-ND/285311). That'd be {" 30 cents per device for making it much more unbreakable and interoperable "}. Does that sound like a good thing for an educational device?
{% endpullquote %}

A Black Sheep In the Family
---------------------------

I'm not an idealist. I can understand and, to some degree, accept the business goals which led to inclusion of a patented CPU and closed-source drivers and firmware in my smartphone. In fact, I don't care about patents, and vast majority of people don't care about openness of drivers. In the current ecosystem, the latter provides very little realistic value to an average customer of a consumer-oriented device.

<span class="pullquote-left" data-pullquote="for educational means an open system is a thousand times better than a fast system">
Unfortunately, Raspberry Pi is (ostensibly) not about business, and for educational means an _open_ system is a thousand times better than a _fast_ system. The Pi is often [compared](http://technabob.com/blog/2012/07/11/ben-heck-raspberry-pi-computer/) to BBC Micro; the latter was an excellent device for students, but it was slow even if compared with other computers of those days.
</span>

Everything becomes pretty clear when you consider that Pi Foundation has a sweet supplying deal with Broadcom, that its [director](http://www.linkedin.com/in/ebenupton) works for Broadcom and the amount of hype generated. Even if they [deny it](http://news.ycombinator.com/item?id=2974500), the whole Raspberry Pi community has promoted the Broadcom brand quite a bit.

Oh, and before calling this a conspiracy theory, take a look at the [sister site](http://www.raspberrypi.com/) of Pi Foundation. That's right: instead of promiting free, open and royalty-free standards like [WebM](http://www.webmproject.org), the Foundation _sells licenses_ for two proprietary and obsolete video encoders. Also, if you want the Foundation to send more documentation to you, they require you to [provide a _business model_](http://www.raspberrypi.org/faqs). This has nothing to do with education and everything with marketing.

Mr. Wizard, Get Me Out of Here
------------------------------

Unfortunately, at the present moment there are no open-source software solutions for embedded GPUs. Reverse engineering effort is ongoing, with [Lima project](http://limadriver.org/) being one of the most promising ones, but it's just not there yet. Fortunately, not Beagle Board nor ODROID-X require GPU drivers (or, for that matter, any proprietary code or binaries at all) for regular operation. You'd only need them for rendering accelerated graphics.

If you are looking to develop truly open hardware, take a look at [Milkymist One](http://milkymist.org/3/). It isn't cheap, but is worth way more than its cost.

If you are looking for a more sane alternative to Pi, consider buying [Texas Instruments Beagle Board](http://en.wikipedia.org/wiki/Beagle_Board) or [Samsung ODROID-X](http://www.hardkernel.com/renewal_2011/products/prdt_info.php?g_code=G133999328931). Both vendors have released complete documentation for the SoC (except for the graphics processor, see more on that below), and are generally more friendly to open-source community than Broadcom.

Beagle Board has a bigger price tag, but don't forget that they include all required accessories, extensive documentation, complete schematics and layout released under a Creative Commons license, an ability to plug in Arduino without frying the critter and a way to run your own code without third-party proprietary binaries. It is an example of excellent open-source hardware which perfectly fits educational needs.