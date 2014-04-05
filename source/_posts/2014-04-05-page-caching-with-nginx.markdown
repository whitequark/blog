---
layout: post
title: "Page caching with Nginx"
date: 2014-04-05 13:25 UTC+4
comments: true
categories:
  - software
---

For [Amplifr][], I needed a simple page caching solution, which would work with multiple backend
servers and require minimal amount of hassle. It turns out that just Nginx (1.5.7 or newer) is
enough.

<!--more-->

First, you need to configure your backend. This consists of emitting a correct `Cache-Control`
header and properly responding to [conditional GET] requests with `If-Modified-Since` header.

Amplifr currently emits `Cache-Control: public, max-age=1, must-revalidate` for cacheable pages.
Let's take a closer look:

  * `public` means that the page has no elements specific to the particular user, so the cache
    can send the cache content to several users.
  * `max-age=1` means that the content can be cached for one second. As will be explained later,
    `max-age=0` would be more appropriate, but that directive would prevent the page from
    being cached.
  * `must-revalidate` means that after the cached content has expired, the cache must not respond
    with cached content unless it has forwarded the request further and got `304 Not Modified`
    back.

This can be implemented in Rails with a `before_filter`:

{% codeblock lang:ruby %}
class FooController < ApplicationController
  before_filter :check_cache

  private
  def check_cache
    response.headers['Cache-Control'] = 'public, max-age=1, must-revalidate'
    # `stale?' renders a 304 response, thus halting the filter chain, automatically.
    stale?(last_modified: @current_site.updated_at)
  end
end
{% endcodeblock %}

Now, we need to make Nginx work like a public cache:

{% codeblock %}
http {
  # ...
  proxy_cache_path /var/cache/nginx/foo levels=1:2 keys_zone=foocache:5m max_size=100m;

  server {
    # ...

      proxy_pass              http://foobackend;
      proxy_cache             foocache;
      proxy_cache_key         "$host$request_uri";
      proxy_cache_revalidate  on;
      # Optionally;
      # proxy_cache_use_stale error timeout invalid_header updating
                              http_500 http_502 http_503 http_504;
    }
  }
}
{% endcodeblock %}

The key part is the `proxy_cache_revalidate` setting. Let's take a look at the entire
flow:

  * User agent A performs `GET /foo HTTP/1.1` against Nginx.
  * Nginx has a cache miss and performs `GET /foo HTTP/1.0` against the backend.
  * Backend generates the page and returns `200 OK`.
  * Nginx detects that `Cache-Control` permits it to cache the response for 1 second,
    caches it and returns the response to user agent A.
  * *(time passes...)*
  * User agent B performs `GET /foo HTTP/1.1` against Nginx.
  * Nginx has a cache hit (unless the entry was evicted), but the entry has already
    expired. Instructed by `proxy_cache_revalidate`, it issues `GET /foo HTTP/1.0`
    against the backend and includes an `If-Modified-Since` header.
  * Backend checks the timestamp in `If-Modified-Since` and detects that Nginx's
    cache entry is not actually stale, returning `304 Not Modified`. It doesn't
    spend any time generating content.
  * Nginx sets the expiration time on cache entry to 1 second from now and
    returns the cached response to the user agent B.

Some notes on this design:

  1. Technically, performing a conditional GET requires sending an HTTP/1.1 request,
     but Nginx is only able to talk HTTP/1.0 to the backends. This doesn't seem to
     be a problem in practice.
  2. Ideally, specifying `max-age=0` in `Cache-Control` would instruct the cache
     to store and always revalidate the response, but Nginx doesn't cache it at all
     instead. HTTP specification [permits][max-age] both behaviors.
  3. You can specify `proxy_cache_use_stale` directive, so that if the server crashes
     or becomes unresponsive, Nginx would still serve some cached content. If the
     frontpage is static, it's a good way to ensure it will be accessible at all times.

[amplifr]: http://amplifr.com
[conditional get]: http://www.w3.org/Protocols/rfc2616/rfc2616-sec9.html#sec9.3
[max-age]: http://www.w3.org/Protocols/rfc2616/rfc2616-sec14.html#sec14.9.3
