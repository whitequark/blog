---
layout: post
title: "Tweaking Linux TCP Stack for Lossy Wireless Networks"
date: 2011-09-12 22:44
comments: true
categories:
 - linux
 - network
---

Public wireless networks are often congested and located in a noisy RF environment. Standard TCP congestion control algorithms work inefficiently in these conditions, leading to frequent timeouts, large <abbr title="Round Trip Time">RTTs</abbr> and poor overall performance. There are some tricks, however, which can be enabled to improve it a lot.
<!--more-->

Linux TCP stack may be configured via `sysctl` utility. The TCP options are listed in `man 7 tcp`, and they are located in `net.ipv4` namespace. (Well, technically there is one for IPv6, too, but I haven't seen a single IPv6-enabled public network, ever). So, the option `tcp_foo` may be set to `1` by invoking `sysctl net.ipv4.tcp_foo=1`.

Interestingly, changing the TCP congestion control algorithms did not yield any visible result. On the other hand, changing several other options did.

There are three options worth mentioning. First two are related to [F-RTO][], a recovery algorithm designed specially for wireless networks.

{% codeblock Excerpt from `man 7 tcp' %}
       tcp_frto (integer; default: 0; since Linux 2.4.21/2.6)
              Enable  F-RTO,  an enhanced recovery algorithm for TCP retrans‐
              mission timeouts (RTOs).   It  is  particularly  beneficial  in
              wireless  environments  where  packet  loss is typically due to
              random radio interference rather than intermediate router  con‐
              gestion.  See RFC 4138 for more details.

              This file can have one of the following values:

              0  Disabled.

              1  The basic version F-RTO algorithm is enabled.

              2  Enable  SACK-enhanced  F-RTO  if  flow uses SACK.  The basic
                 version can be used also when SACK is in use though in  that
                 case scenario(s) exists where F-RTO interacts badly with the
                 packet counting of the SACK-enabled TCP flow.
{% endcodeblock %}

The `tcp_frto` option is set to 2 by default on Debian, which is the recommended setting, but changing it to 1 sometimes improves the performance.

{% codeblock Excerpt from `man 7 tcp' %}
       tcp_frto_response (integer; default: 0; since Linux 2.6.22)
              When  F-RTO  has detected that a TCP retransmission timeout was
              spurious (i.e, the timeout would have been avoided had TCP  set
              a  longer retransmission timeout), TCP has several options con‐
              cerning what to do next.  Possible values are:

              0  Rate halving based;  a  smooth  and  conservative  response,
                 results  in  halved  congestion window (cwnd) and slow-start
                 threshold (ssthresh) after one RTT.

              1  Very conservative response;  not  recommended  because  even
                 though  being  valid,  it  interacts poorly with the rest of
                 Linux TCP; halves cwnd and ssthresh immediately.

              2  Aggressive response; undoes congestion-control measures that
                 are now known to be unnecessary (ignoring the possibility of
                 a lost retransmission that would require TCP to be more cau‐
                 tious);  cwnd  and ssthresh are restored to the values prior
                 to timeout.
{% endcodeblock %}

This option is set to 0 by default, as the manpage suggests, but changing it to 2 makes retransmission delays much smaller.

{% codeblock Excerpt from `man 7 tcp' %}
       tcp_low_latency (Boolean; default: disabled; since Linux 2.4.21/2.6)
              If  enabled,  the  TCP  stack makes decisions that prefer lower
              latency as opposed to higher throughput.   It  this  option  is
              disabled,  then  higher throughput is preferred.  An example of
              an application where this default should be changed would be  a
              Beowulf compute cluster.
{% endcodeblock %}

Again, this option is disabled by default, and it seems that after enabling it, TCP stack prefers to retransmit more often.

You could make this settings to be applied on boot by adding them to `/etc/sysctl.conf`:

{% codeblock lang:ini /etc/sysctl.conf %}
# TCP stack tweaking for lossy wireless networks
net.ipv4.tcp_frto = 1
net.ipv4.tcp_frto_response = 2
net.ipv4.tcp_low_latency = 1
{% endcodeblock %}

  [f-rto]: http://www.sarolahti.fi/pasi/papers/frto-ccr.pdf
