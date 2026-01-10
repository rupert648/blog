
+++
title = "My growing lack of trust in typescript code"
date = "2025-02-17"

[taxonomies]
tags = ["Software", "Typescript", "Javascript", "Rust" ]

[extra]
repo_view = true
comment = true
+++

## Introduction

I have worked both on large scale high traffic Typescript and Rust systems, and most recently a weird mutation of the two through [napi-rs](https://napi.rs/).
Whilst there are plenty more experienced than I, this most recent adventure has given me a unique point of reference on the differences, pain points and benefits of each.

Firstly I want to preface by saying I *love* typescript, I try and stay away from the types vs untyped debate on various social medias for my own sanity, but once you reach a project
of an even moderate size, I will admit I really struggle to see how the untyped side of the debate isn't massively overshadowed by the benefits that type safety brings. Furthermore, none
of the ideas I am presenting here are novel, in fact they have been talked about in length, I just wanted an outlet for my own pain.

So what is this article all about? If typescript is so great and so much better than Javascript, why is my distrust in typescript code, day to day, still growing?
This article, I guess, is now just a further extension of these type philosophies and as I hope to demonstrate in this article, genuine practicalities I've found of extending this type
safety one step further beyond typescript, and how doing to so elevates the level of reliability you can have in your software.

## Types

There are a million and one articles out on the internet over why types are beneficial, and I don't expect to convince you in this one article, I just hope to show you some examples of why
even Typescript has its limitations over a more strongly run-time typed language; in this case Rust.

{{ note(center=true, header="",body="Typescript's safety is only as strong as the programmers motivation to use it.") }}

As I'm sure most readers of this article are aware, Typescript is a *compile time* typed language. Type checks are only enforced at the time of compilation, and to ensure types are satisfied at runtime
runtime checks must be introduced. Entire libraries are dedicated to this functionality such as [zod.dev](https://zod.dev/). This leads to my and many people's first gripe; Typescripts safety is only as strong
as the programmers motivation to use it.

The most obvious example of this is the `any` type; cant be arsed to fill out that annoying type definition? Stick an `any` in there and you're good to go. There. You've just made typescript obsolete,
albeit in a very transparent way. This is easily rectified in any sensible project; just disable any. But its also still surprisingly easy to lie to the compiler, heres an example;
```ts
interface User {
  name: string;
  age: number;
}

// This is clearly wrong, but TypeScript accepts it
const fakeUser = {} as User;  // No error, even though properties are missing

console.log(fakeUser.name.toUpperCase());  // TypeError: Cannot read properties of undefined
```
This kind of pattern is actually extremely common. The best and most frequent example I have seen is when reading some external IO source, such as the response from a service.
Each time I encounter this pattern in production code, my trust erodes a little more. What started as a strongly-typed promise becomes a game of 'hope the runtime data matches our types'.

I mentioned above our mutant typescript-rust project I am currently working on, where we are slowly migrating the typescript code to rust, and one of the most common forms of bugs we face is
when translating the typescript objects to rust structs, our typescript types for services responses were wrong!

Take the above example
```ts
type User = {
  name: string;
  age: number;
}
```
Converting this to rust would give the following struct
```rust
#[derive(Deserialize, Serialize)]
struct User {
  name: String;
  age: String;
}
```
Now lets look at the typescript code to read this response from a service:
```ts
async function fetchUser(): Promise<User> {
  const response = await fetch('/api/user');
  const data = await response.json();
  
  return data as User;  
}
```
And the rust code:
```rust
async fn fetch_user() -> Result<User, Box<dyn Error>> {
    let response = reqwest::get("/api/user").await?;
    
    let user: User = response.json().await?;

    Ok(user)
}
```
Now lets say we get such a response from our api service
```json
{
  name: "Rupert"
}
```

So now we've actually moved to rust, we noticed that our typescript code was *wrong*. The rust code would blowup immediately at our `response.json()` line, whilst the typescript code would trundle
happily on. Whilst an error is never fun, this is a good thing! We have *failed fast and early*. From this translation we've immediately caught a bug, 
which if left to fester in the typescript code as an unknown `undefined` could have hurt us in more subtle, but painful ways. 
This is where my trust really started to crack. We had months of production TypeScript code running with incorrect types, silently accepting malformed data. 
The compiler happily verified our lies, while Rust refused to participate in our self-deception.

## Error Handling

{{ note(center=true, header="",body="Try catch is like throwing a glass of water into a crowded room, where everyone is blindfolded, and expecting the glass to be caught without spilling a drop.") }}

The next thing I want to talk about is error handling.
Notice in the rust code how we had to **explicitly** handle all the possible errors. 

```rust
async fn fetch_user() -> Result<User, Box<dyn Error>> {
    let response = reqwest::get("/api/user").await?;
    
    let user: User = response.json().await.expect("User API response didn't match expected shape.");

    Ok(user)
}
```
* our function returns `Result`
* our use of reqwest uses `?` to subtly the error case of `request::get`
* our use of reqwest uses `?` to subtly the error case of `response.json()`

This comes on to my next big gripe - not just with typescript but far too many other languages - try catch error handling.
God, after writing production rust code as my main output for a number of months now, I ***HATE*** try catch with a burning passion.
Try catch is like throwing a glass of water into a crowded room, where everyone is blindfolded, and expecting the glass to be caught without spilling a drop.

When calling a function in TypeScript, you literally have no idea whether that function will return an error or not! 
It's so crazy after getting used to constructs like Result in Rust or _val, err in Go.
In TypeScript, you're basically working blind - any function could throw at any time, for any reason, and the type system gives you zero help.
You can't tell by looking at a function signature whether it might explode in your face. 
The worst part is that this invisibility of errors means they often go unhandled, bubbling up through your application until they crash something important.
Meanwhile, Rust and Go and a number of other languages which aren't java or javascript force you to acknowledge and handle errors explicitly - the compiler won't let you ignore them.
It's like the difference between walking through a minefield with a metal detector versus walking through blindfolded and hoping for the best. Or even better, in languages
such as Rust there are literal signs marking exactly where a bomb lies.
As so many others have emphasised in the past, try-catch feels like a trust exercise gone wrong. 
When I call a TypeScript function, I have to trust that someone, somewhere, has handled all possible errors, or blindly throw on my own error handling logic just in case.
After seeing too many unhandled promise rejections in production, that trust is hard to maintain.

{{ note(center=true, header="",body="Typescript types are an exercise in convincing, rust types are an exercise of proof.") }}

Sometimes, I want everything to blowup, because it means some error in my logic. But the key difference is that in rust *I have explicit control over this*.
Lets return one last time to our user example. Lets say in this case we own the user api, and we are handling the response from another microservice we control.
In this case, if our struct is incorrect, it makes sense to completely blow up, as this indicates some error with our own implementation either on
this service or the user api service which we own. This is distinct from an input from an uncontrolled source such as user input.

In rust, we can make this super easy.
```rust
async fn fetch_user() -> Result<User, Box<dyn Error>> {
    let response = reqwest::get("/api/user").await?;
    
    let user: User = response.json().await.expect("User API response didn't match expected shape.");

    Ok(user)
}
```
Of course this is possible in TS as well, but remember what I said about effort in TS? We have to go through and add the blowup logic ourselves, using some validation library such
as zod or other, or go and throw down a bunch of the ugly and dreaded `if (user.name && typeof user.name === 'string')...`. My key point is this; Typescript types are an exercise in convincing, rust types are an exercise of proof.

### Conclusion
This isn't about TypeScript being bad - it's about understanding its limitations. 
My trust hasn't eroded because TypeScript failed to deliver on its promises, but because those promises were more modest than we initially assumed. 
As our systems grow more complex, we need guarantees, not gentle suggestions. We need proof, not trust.

Is this article telling you to stop using Typescript and rewrite everything in rust? Of course not! Typescript is and will likely be for a long time
my go to language for hobby projects and spinning up prototypes quickly, but lets just set reasonable expectations on what we can expect to achieve with only compilation time guarantees.

