---
layout: post
title: "Fixing ACPI on Samsung N250"
date: 2011-09-04 07:42
comments: true
categories: 
---

In this article I'd like describe some of the typical BIOS design flaws of a modern netbook, and methods which can be used to locate, dissect and heal the bugs.
<!--more-->

Introduction
------------

First of all, [ACPI][] is a generic management interface which controls a lot of hardware functions on modern computers ranging from power and battery control to detecting external displays.
It consists of a several configuration _tables_, one of which contains code for a virtual machine to be executed by an operating system kernel. The latter was added to make the system as flexible as possible.

Theoretically, this system should have been made hardware-specific chipset drivers unneccessary. It is quite potent (not to say overblown) and is definitely able to accomplish the task; Macs are a good example, as they use ACPI extensively and correctly.

In reality, however, [x86][]-based hardware vendors would supply buggy and incomplete ACPI tables for their systems, and vendor lock-in appears not as the least reason to me. Therefore, such systems require numerous nontrivial workarounds, often flawed and undocumented. I've attempted to fix the ACPI itself for a particular computer instead.

The system I have is a Samsung N250+ netbook. It has quite good hardware (except for battery-hungry and quirky Broadcom WLAN card which I have replaced with a better one by Atheros), but the ROM BIOS quality is really poor. At the moment of release there even was no way of enabling the wireless card on a Linux system; its state could be changed via CMOS Setup, through. Now there is a kernel driver, but it uses a fundamentally flawed approach, too (and it has some [usability problems][]).

  [acpi]: http://en.wikipedia.org/wiki/ACPI
  [x86]: http://en.wikipedia.org/wiki/x86
  [usability problems]: http://comments.gmane.org/gmane.linux.drivers.platform.x86.devel/2403

Examining the current state
---------------------------

Support for features of the laptop which ACPI has lacked was initially provided by an [easy slow down manager][] kernel module, which was eventually merged to the kernel under the name [samsung-laptop.c][sl].

As can be seen on [line 725 of the source][sl-smi], this driver uses SMI calls (via an interface called SABI) to set the backlight level, change performance mode (this actually changes just the fan speed) and control the wireless card power. An <abbr title="System Management Interface">SMI</abbr> call is a command which leads CPU into so-called System Management Mode: a special processor and chipset feature which is equally similar to a hypervisor and a rootkit.

BIOS can set up the chipset to intercept certain operations (like accessing memory or I/O ports) and launch SMM, which cannot be detected nor interrupted by OS. It then may execute arbitrary code: for example, SMM is used to trick old OSes (think of DOS) to believe that a USB mouse is actually a PS/2 one without any changes to the OS itself. Moreover, a memory area which belongs to SMM under no circumstances can be accessed by the OS, making it impossible to study its behavior directly.

Hopefully, in this case SMI calls probably just change a byte or two, and it may be possible to determine their locations without examining SMM code itself.

Next, let's take a look at the ACPI tables. There are plenty of them, but we need one called _<abbr title="Differentiated System Description Table">DSDT</a>_—the biggest and most important one which contains handlers for a huge number of possible hardware events.

To dump the tables and rework the code two utilites are required: `acpidump` and `iasl`. On a Debian-based system they can be found in packages with same names. 

``` console
    $ sudo acpidump -o dsdt.aml -b
    $ iasl -d dsdt.aml # generates dsdt.dsl
```

To ease the demonstration, I've uploaded the table on [github][]; initial state can be checked out [here][dsdt-initial]. As you can see, the table is quite big at more than 5000 lines; tables more than 25000 lines long are not uncommon.

At an attempt to compile the table back to bytecode (try `make`) without any changes, the compiler will spit out a few warnings and errors. They are quite trivial to fix just by looking at error messages and [ACPI specification][]; this [Gentoo forum thread][] has some pointers as well. Note that while the manual is _7 years_ older than my notebook, the latter has roughly same quirks as described (and fixes do work, too). Fixed version can be found [at this commit][dsdt-fixed].

  [easy slow down manager]: http://code.google.com/p/easy-slow-down-manager/
  [sl]: http://git.kernel.org/?p=linux/kernel/git/stable/linux-3.0.y.git;a=blob;f=drivers/platform/x86/samsung-laptop.c;h=d347116d150e38146eedf6e817e51afc84898169;hb=HEAD
  [sl-smi]: http://git.kernel.org/?p=linux/kernel/git/stable/linux-3.0.y.git;a=blob;f=drivers/platform/x86/samsung-laptop.c;h=d347116d150e38146eedf6e817e51afc84898169;hb=HEAD#l725
  [github]: http://github.com/whitequark/n250-dsdt
  [dsdt-initial]: https://github.com/whitequark/n250-dsdt/commit/35fca49c1b5ae8b85603aeaedec9ed30c604ba79/
  [acpi specification]: http://www.acpi.info/DOWNLOADS/ACPIspec40a.pdf
  [gentoo forum thread]: http://forums.gentoo.org/viewtopic.php?t=122145
  [dsdt-fixed]: https://github.com/whitequark/n250-dsdt/commit/513e61875a3b2cb2ade0911d24fe72cbb85e275a

Repairing backlight
-------------------

My netbook has LED backlight, which means that its brightness could be controlled simply by keeping it on for a known part of time, e.g. to dim it by 30% one could keep it on just for 70% of time. To make the flickering invisible, this switching (called [PWM][] is done on a frequency far above the sensitivity level of a human eye—200 kHz is good enough).

In this case, PWM _duty cycle_ is probably controlled by an integrated graphics controller. We can see it on a PCI bus:

``` console
    $ lspci 
    00:00.0 Host bridge: Intel Corporation N10 Family DMI Bridge
    00:02.0 VGA compatible controller: Intel Corporation N10 Family Integrated Graphics Controller
    00:02.1 Display controller: Intel Corporation N10 Family Integrated Graphics Controller
    <...>
```

The numbers `00:02.0` are an address of the device on the bus. With this address, we can inspect and modify the properties of the device, as Linux provides numerous [sysfs][] hooks for that purpose. One of them is an ability to read and write [PCI configuration space][]: a memory block of 256 bytes used to configure a PCI devide. First 64 of them have predefined meaning; other ones can be freely used by device vendor.

Let's check what changes in the device configuration when we alter backlight level with an SMM-based driver (note that it would be perfectly possible with a closed-source driver or even on Windows: all you need is a tool to scrap the configuration space):

``` console
    # echo 7 >/sys/class/backlight/samsung/brightness 
    # hexdump -C /sys/bus/pci/devices/0000\:00\:02.0/config >config-1
    # echo 5 >/sys/class/backlight/samsung/brightness 
    # hexdump -C /sys/bus/pci/devices/0000\:00\:02.0/config >config-2
    # diff -u config-1 config-2
    --- config-1	2011-09-05 01:06:13.326930250 +0400
    +++ config-2	2011-09-05 01:06:21.503828025 +0400
    @@ -13,5 +13,5 @@
     000000c0  00 00 00 00 01 00 00 00  00 00 00 00 a7 00 00 00  |................|
     000000d0  01 00 22 00 00 00 00 00  00 00 00 00 00 00 00 00  |..".............|
     000000e0  00 00 00 00 00 00 00 00  00 80 00 00 00 00 00 00  |................|
    -000000f0  79 00 00 00 ff 00 00 00  ad 0f 00 00 7c 0e 5c 7f  |y...........|.\.|
    +000000f0  79 00 00 00 73 00 00 00  ad 0f 00 00 7c 0e 5c 7f  |y...s.......|.\.|
     00000100
```

So, the byte at index `0xf4` controls the brightness level. This can be verified by running `sudo setpci -s 00:02.0 f4.b=80` (replacing the `80` with a brightness value).

Now, let's set up DSDT code to update this value (and possibly determine the cause for it to not work in first place).

According to [ACPI specification][] (section B.6.2, page 704), a compliant graphic adapter description should implement methods `_BCL`, `_BCM` and `_BQC`. Our DSDT has these methods defined at [line 1767][dsdt-bcl]. Here is the annotated source code:

``` c
    /*  = Query List of Brightness Control Levels Supported =
     * Returns an array (Package in ACPI terms) which contains 
     * supported and preferred backlight levels.
     */
    Method (_BCL, 0, NotSerialized)
    {
        /* Flip a bit in GVNS system memory region (line 132).
           I don't know what it does. */
        Or (VDRV, 0x01, VDRV)

        Return (Package (0x08)
        {
            0x64, /* Preferred level for AC power */
            0x05, /* Preferred level for battery power */
            0x0F, /* A list of valid brightness levels */
            0x18, /* 24 */
            0x1E, /* 30 */
            0x2D, /* 45 */
            0x3C, /* 60 */
            0x50  /* 80 */
        })
    }

    /*  = Set the Brightness Level =
     * Receives the target brightness in Arg0.
     * OS guarantees that it will be included in list
     * returned by _BCL method.
     */
    Method (_BCM, 1, NotSerialized)
    {
        /* Divide Arg0 by 10. Remainder goes to Local0, result
         * is placed in Local1. */
        Divide (Arg0, 0x0A, Local0, Local1)

        /* Predicate names are beginned with L (from "Logic") in
         * ACPI. Here, LEqual(Local0, 0x00) may be written as
         * (Local0 == 0x00) in C.
         *
         * As you can see, for half of valid brightness levels this
         * will silently do nothing.
         */
        If (LEqual (Local0, 0x00))
        {
            /* Pass the target level to BRTW function (line 5324).
             * It does not work. */
            BRTW (Arg0)
        }
    }

    /*  = Brightness Query Current level =
     * Return current level. The value should be contained in
     * list returned by _BCL method.
     */
    Method (_BQC, 0, NotSerialized)
    {
        /* See above. */
        Divide (BRTL, 0x0A, Local0, Local1)
        If (LEqual (Local0, 0x00))
        {
            /* Return BRTL value, which should have been updated
             * by BRTW function (at line 5341). */
            Return (BRTL)
        }
    }
```

To make this work via PCI configuration space writing, a new field first should be defined in an ACPI structure describing that space. The adapter has an address of `00:02.0`; this corresponds to a value of `0x00020000` ACPI can understand as an address of a PCI device (section 6.1.1 on page 200). A device with such an address is defined at [line 1325][dsdt-igd0]; the PCI configuration space description follows.

As was said, first 64 (`0x40`) bytes in this space are reserved for internal purposes. Because of that, ACPI does not even include them to the region: it is defined as `OperationRegion (IGDP, PCI_Config, 0x40, 0xC0)`, where third argument means a count of bytes skipped from the beginning. Our brightness byte with a whole-space address of `0xf4` is located at position `0xb4` in this region.

Below that, field definitions are located. The whole `Field` construct represents a stream of bit fields (the field length is defined in bits, not bytes), where one can be placed after another, or at a particular `Offset` (contrary to fields, offsets are given in bytes). Let's call our brightness level field `BLVL` and incorporate it to the structure:

{% codeblock lang:diff %}
@@ -1347,7 +1347,8 @@ Device (IGD0)
                             Offset (0xB0), 
                             Offset (0xB1), 
                     CDVL,   5, 
-                            Offset (0xB2), 
+                            Offset (0xB4),
+                    BLVL,   8,
                             Offset (0xBC), 
                     ASLS,   32
                 }
{% endcodeblock %}

As ACPI has hierarchical naming system, our field is now globally accessible as `\_SB.PCI0.IGD0.BLVL` (the name is defined by the nesting of `Device` and `Scope` clauses). We can now rewrite three backlight control methods to access `BLVL` field directly:

``` c
    Method (_BCL, 0, NotSerialized)
    {
        /* It's a good idea to keep things you don't know
         * what they do. */
        Or (VDRV, 0x01, VDRV)

        /* Levels at PCI control point range from
         * 0x00 to 0xff. Let there be 16 points. */
        Return (Package (0x12)
        {
            0xEE, /* proposed on AC adapter on */
            0x22, /* proposed on AC adapter off */
            0x01, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66,
            0x77, 0x88, 0x99, 0xAA, 0xBB, 0xCC, 0xDD,
            0xEE, 0xFF
        })
    }

    Method (_BCM, 1, NotSerialized)
    {
        Store (Arg0, \_SB.PCI0.IGD0.BLVL)
    }

    Method (_BQC, 0, NotSerialized)
    {
        Return (\_SB.PCI0.IGD0.BLVL)
    }
```

Updated DSDT can be found in the [repository][dsdt-blfix].

While testing the changes, I've encountered a need for debugging the code. This can be done with a `Store (something, Debug)` command. Don't forget to enable ACPI debug output by adding `acpi.debug_level=0x1f` parameter to kernel command line.

The changed and compiled (`iasl -tc dsdt.dsl`) DSDT should now replace vendor-provided one. To achieve the goal, we could reflash the BIOS—but it is not even known where DSDT is located in it. So, a simpler approach can be used: Linux can be instructed to ignore the DSDT found in system RAM and load a provided one instead. To do that, you should place compiled file `dsdt.hex` (verify that it contains a C array definition; the `-tc` option instructs `iasl` to emit one) in `include/` directory of Linux source tree and set option `CONFIG_ACPI_CUSTOM_DSDT_FILE` to `dsdt.hex`. (To be able to access the latter, you should turn off `CONFIG_STANDALONE`; it is named “Select only drivers that do not need compile-time external firmware” and located in “Generic driver options”.)

Compile the modified kernel and reboot. Voilá: ACPI driver can now set backlight level. (Try `echo 7 >/sys/class/backlight/acpi_video0/brightness`).

  [pwm]: http://en.wikipedia.org/wiki/Pulse-width_modulation
  [sysfs]: http://en.wikipedia.org/wiki/Sysfs
  [pci configuration space]: http://en.wikipedia.org/wiki/PCI_configuration_space
  [dsdt-bcl]: https://github.com/whitequark/n250-dsdt/blob/513e61875a3b2cb2ade0911d24fe72cbb85e275a/dsdt.dsl#L1767
  [dsdt-igd0]: https://github.com/whitequark/n250-dsdt/blob/513e61875a3b2cb2ade0911d24fe72cbb85e275a/dsdt.dsl#L1325
  [dsdt-blfix]: https://github.com/whitequark/n250-dsdt/commit/5263e541ffc223325136a78e49008cc7c988a3b8#diff-0

Other features
--------------

To locate other fields in the PCI configuration space which might be changed by SMM-based driver, I wrote a [simple script][diff-pci]. Note that some devices, namely PCI-Express bridges and network adapters, have a lot of spurious changes which happen in background on their own.

Sadly, not the fan speed nor wireless rfkill switch state were not linked to any changes within the configuration space. I guess that they may be done through [Embedded Controller][] and via [SMBus][] interface, which means that no permanent changes are accumulated in the system RAM itself, and all of the processing is buried deep inside the SMM BIOS.

Moreover, even if I could find the rfkill interface, there is no standard way to describe it in ACPI. On laptops where it actually is exported via ACPI, there is a platform-specific driver handling that (contrary to the backlight, which can be controlled in a generic way).

  [diff-pci]: https://gist.github.com/1193679
  [embedded controller]: http://www.coreboot.org/Embedded_controller
  [smbus]: http://en.wikipedia.org/wiki/SMBus
