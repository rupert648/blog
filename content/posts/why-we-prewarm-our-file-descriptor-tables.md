+++
title = "Why we prewarm our file descriptor tables (and why you should too)"
date = "2026-04-23"

[taxonomies]
tags = ["Software", "Rust"]

[extra]
repo_view = true
comment = true
+++

[Dial9](https://github.com/dial9-rs/dial9-tokio-telemetry) was recently released by the tokio team and blew up on hacker news. It's a very cool looking piece of software
worthy of a blog post in and of itself; luckily for us they've [done that themselves](https://tokio.rs/blog/2026-03-18-dial9).

When reading it one section stuck out to me in particular, enough so for me to dive into the technical details myself. The section in question was titled "Finding fd_table contention" where they
describe how dial9 was used to find a startup performance problem due to lock contention whilst resizing the file descriptor table. This later came with a [PR](https://github.com/dial9-rs/dial9-tokio-telemetry/pull/100)
in the dial9 repo showing a possible fix. In this blog post, I want to further break down the change this PR introduces, and more importantly the problem it solves.

This post assumes some basic unix and rust programming knowledge.

# File Descriptors

Let's start with what the heck a file descriptor and file descriptor table (FD Table) is.
We need to remember that in unix ecosystems ~~ everything is a file; files, sockets, pipes, devices etc etc, all are represented
by the same struct (shockingly this is called [struct file](https://github.com/torvalds/linux/blob/master/include/linux/fs.h#L1259)).
File descriptors are **non negative, per process unique integers**, each of which is an index in the **file descriptor table**. This value in the file descriptor table, accessed by the file descriptor, holds a pointer to that file's `struct file` object. This then
contains info about said file (status, offset, access mode), as well as a pointer down to the **inode**. The inode is itself
the actual filesystem object (e.g. socket struct, device, whatever).

Opus 4.6 drew the below to illustrate this (be nice I tried to fix where it struggled with lines)

```
  ┌─────┬─────────┐
  │  0  │    ●──────────────┐
  ├─────┼─────────┤         │
  │  1  │    ●───────────┐  │
  ├─────┼─────────┤      │  │    ┌──────────────────┐
  │  2  │    ●─────────┐ │  │    │ f_pos: 0         │        ┌──────────────────┐
  ├─────┼─────────┤    │ │  └───>│ f_flags: O_RDONLY│        │ /dev/stdin       │
  │  3  │    ●───────┐ │ │       │ f_inode: ●───────────────>│ i_mode: 0444     │
  ├─────┼─────────┤  │ │ │       └──────────────────┘        └──────────────────┘
  │  4  │  NULL   │  │ │ │
  ├─────┼─────────┤  │ │ │       ┌───────────────────┐
  │  5  │    ●──────┐│ │ └──────>│ f_pos: 128        │        ┌──────────────────┐
  ├─────┼─────────┤ ││ │         │  f_flags: O_WRONLY│        │ /dev/pts/0       │
  │ ... │         │ ││ │         │  f_inode: ●───────────────>│ i_mode: 0620     │
  └─────┴─────────┘ ││ │         └───────────────────┘        └──────────────────┘
                    ││ │
                    ││ └─────────>┌──────────────────┐
                    ││            │ f_pos: 4096      │        ┌──────────────────┐
                    ││            │ f_flags: O_RDWR  │        │ /var/log/app.log │
                    ││            │ f_inode: ●───────────────>│ i_mode: 0644     │
                    ││            └──────────────────┘        └──────────────────┘
                    ││
                    │└ dup() ─┐
                    │         │   ┌──────────────────┐
                    └─────────┴──>│ f_pos: 0         │        ┌──────────────────┐
                                  │ f_flags: O_RDWR  │        │ socket:[51432]   │
                                  │ f_inode: ●───────────────>│ i_mode: 0777     │
                                  └──────────────────┘        └──────────────────┘
```

# File Descriptors in your web server

So; each process you are running has its own file descriptor table. Now let's talk about what this looks like in the world of web servers.

When you start up an HTTP server, you spawn a **listening** socket - there's one FD.
Then each time a new client connects (i.e. kernel has done its job and finished the handshake syn ack etc), that client's fully established connection
is put into the queue on your listening socket.

Under the hood, whatever HTTP server framework you're using will be polling that socket, and when `accept()` is called, we pop a connection off of
that queue and **return a brand new file descriptor for it**. I.e. every connection == another FD.

Of course, in the background there is some garbage collection - when a [connection is closed](https://github.com/rust-lang/rust/blob/main/library/std/src/os/fd/owned.rs#L216)
the kernel marks that file descriptor index as free. Crucially, whenever we grab a new file descriptor from the table, they are always allocated **as the lowest available integer**.
I.e. if you close FD 7, the next `accept()` call will reuse slot 7.

That last point is key and what the PR exploits.

# A growing FD Table

So we've just spawned a new HTTP server, or maybe restarted because you used `unwrap()` on client input, either way you now have a new process.
The FD Table is a limited size array which, crucially, starts small. Just like a `Vec` the fd table will dynamically grow as it needs to, growing in powers of two [citation needed].
So when we hit the limit, the kernel has to do some work in the background to **allocate a new, larger array and copy the old one over**.

This is where some applications can start to see performance issues. The FD table is by its very nature concurrent - it's read by multiple threads simultaneously (every syscall
that touches an FD needs to look it up). Linux is clever about this and uses RCU - Read Copy Update. This essentially means that reads can happen without grabbing a lock,
which as you can guess is very important when you have 10s or hundreds of threads all trying to read from the table. However this means that when we
write, i.e. when we need to increase the size of the table to add new values, we must wait **for all** readers to finish what they're doing.
As you can guess if you have a multithreaded tokio server, with many worker threads all doing various bits of IO, that synchronization stall can be slow. How slow? Dial9 measured ~80ms stalls caused by heavy `alloc_fd` calls during FD table growth - that's an eternity for a service trying to handle requests.

This is especially accentuated at startup because the table starts small! If your service restarts and is immediately bombarded by loads of traffic then these RCU locks
will happen one after the another as thousands of new FDs are created - hence you get performance problems!

# The Fix

So now you can see why **pre-warming** the table solves this problem, if you do this before you start listening then bing bang bosh you can 
save yourself some pain.

So let's quickly dive into the code itself! Here it is again, inlined for your reading pleasure;
```rust
fn prewarm_fd_table(target: libc::c_int) {
    unsafe {
        let src = libc::open(c"/dev/null".as_ptr(), libc::O_RDONLY | libc::O_CLOEXEC);
        if src < 0 {
            tracing::warn!("fd prewarm: failed to open /dev/null");
            return;
        }
        let dup = libc::fcntl(src, libc::F_DUPFD_CLOEXEC, target);
        if dup < 0 {
            tracing::warn!(target, "fd prewarm: fcntl F_DUPFD_CLOEXEC failed");
        } else {
            tracing::info!(target, actual = dup, "fd table pre-warmed");
            libc::close(dup);
        }
        libc::close(src);
    }
}
```

Most of this is actually just boilerplate/error handling/finalisation, the only two lines we care about are;
```rust
        let src = libc::open(c"/dev/null".as_ptr(), libc::O_RDONLY | libc::O_CLOEXEC);
```
and
```rust
        let dup = libc::fcntl(src, libc::F_DUPFD_CLOEXEC, target);
```


We'll go through this line by line. First:
```rust
        let src = libc::open(c"/dev/null".as_ptr(), libc::O_RDONLY | libc::O_CLOEXEC);
```
If you've written any systems code this one is actually just as straight forward as it seems - it opens a file in read only mode, in this case /dev/null is chosen
because its always available as a sort of dummy file, meaning its essentially free.
Doing this call gives us back a file descriptor (probably 3 if this code is called at startup, but it'll be whatever is the lowest number available).

After an error check, we then call our second line which is the key
```rust
        let dup = libc::fcntl(src, libc::F_DUPFD_CLOEXEC, target);
```
`fcntl()` is the Linux file control function. It's a pretty general purpose tool for manipulating file descriptors; and does a [bunch of different things](https://man7.org/linux/man-pages/man2/fcntl.2.html).

The second argument specifies the command you want to give, in this case `libc::F_DUPFD_CLOEXEC,` ([docs](https://man7.org/linux/man-pages/man2/F_DUPFD_CLOEXEC.2const.html)).

>  Duplicate the file descriptor fd using the lowest-numbered available file descriptor greater than or equal to arg.

I.e. `fcntl(src, F_DUPFD_CLOEXEC, 10000)` says "give me a copy of src, but make sure the new FD number is at least 10000". The kernel has no choice but to expand the fdtable to accommodate that.
Hence this line alone expands the file descriptor table!

You'll notice that both FDs are closed immediately after. We don't actually need them - we only needed the *side effect* of forcing the kernel to grow the table. This works because the kernel never shrinks the fdtable; once it's been expanded to 10,000 slots, that capacity persists for the lifetime of the process even if every FD is closed. The memory cost is trivial too - each slot is just a pointer, so 10,000 slots is ~80KB.

# Conclusion

So that's it, all in all quite a simple little bit of code you can add to your service, particularly if your service has to quickly
onboard lots of traffic post a startup (e.g. rolling upgrades, graceful restarts etc). This is particularly helpful for helping reduce
the [thundering herd problem](https://en.wikipedia.org/wiki/Thundering_herd_problem). I found it interesting and it forced me to re-examine
and revise my knowledge of file descriptors in the world of Linux.



