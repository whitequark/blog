---
layout: post
title: "Rack::UTF8Sanitizer"
date: 2013-03-05 16:18
comments: true
categories:
  - software
  - ruby
---

Do you have a bunch of these errors in your [Airbrake](http://airbrake.io), [Honeybadger](http://honeybadger.io), Ratch... er, [Rollbar](http://rollbar.com) or whatever's the trending error reporting app?

```
#123430: ActiveRecord::StatementInvalid in releases # show in production
ActiveRecord::StatementInvalid: PG::Error: ERROR: invalid byte sequence for encoding "UTF8":
0xd1 0xf0 : INSERT INTO "raw_stats" ("collected_at", "kind", "resource_id", "resource_type",
"site_id", "user_agent", "utm_source_id") VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING "id"
```

I do. And one day, I've finally had enough of these bogus reports.

Meet [Rack::UTF8Sanitizer](http://rubygems.org/gems/rack-utf8_sanitizer)! Install it, [enable it](https://github.com/whitequark/rack-utf8_sanitizer#usage), and forget about encoding bugs for the rest of your life.
