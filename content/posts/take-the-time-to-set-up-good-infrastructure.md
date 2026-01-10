+++
title = "Take the time to set up good personal infrastructure for your personal sites."
date = "2025-06-10"

[taxonomies]
tags = ["Software", "CI", "Deployment", "Personal Site"]

[extra]
repo_view = true
comment = true
+++

Title says it all really.

There has been a recent, welcome wave risen by the tides of AI in personal computing, or the "decentralized web" or the "indie web" - whatever you want to call it.

Effectively this is people feeling more empowered to host their own highly personalised software, now that the barrier to entry has been massively lowered - both in price point
over the last decade or so, and also much more recently in the skill/knowledge level required to do it.

Despite being a software engineer by trade, I was not immune to this either. I had hosted a relatively modest personal site for a number of years, but it wasn't until somewhat recently
that I felt inspired enough to begin hosting my own software, open source projects, more refined blog etc.

This post is a short one - and is targeted to those perhaps getting started in this space. All I want to say is that you should take the time, just as you would if deploying
a large production system, in your developer tooling. Building, deploying and launching your own software should be fun, but you know whats not fun (except to anarchsists)?
Manual deployments, silent broken builds, or having to ssh into your VPS to deal with a systemctl configuration issue.

Take the time when setting up whatever you're setting up, to make it as easy as possible to ship your code! This is so obvious in the software engineering world, but since my
mindset was always "eh its just my personal site", it took me far too long to get to this point.

The added friction to just simply writing a new blog post, or [updating my glance config](https://github.com/rupert648/pert.dev/blob/main/services/glance/glance.yml) meant that my lazy
ass just became uninspired to do any of it. 

So, PSA: take the couple of hours to write your build and deployment scripts for your crappy little personal project, it'll inspire you to work on it more once the boring stuff is out the way.
These can be as minimal or inventive as you'd like ([read my blog about creating your own pr preview deployments please!](https://pert.dev/posts/easy-pr-previews/)). But you'll thank yourself later

If you need some inspo, feel free to steal some of my bash scripts
  - https://github.com/rupert648/pert.dev/blob/main/scripts/deploy.sh
  - https://github.com/rupert648/pert.dev/blob/main/scripts/preview.sh
  - https://github.com/rupert648/pert.dev/blob/main/scripts/cleanup-preview.sh
