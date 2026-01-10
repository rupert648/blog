+++
title = "PLEASE name your type generics"
date = "2025-12-24"

[taxonomies]
tags = ["Software", "Rust"]

[extra]
repo_view = true
comment = true
+++

WHY as software engineers when, depite all the [memes](https://programmerhumor.io/programming-memes/poor-little-i/), we've agreed pretty unanimously that we should use descriptive names for things, can we still not be arsed 
to properly name our type generics. The compiler supports more than one character people! We insist on the importance of readability, and yet as soon as we get to types
our developer monkey brains seem to resort back to `U` or `T`. This may be fine (debatable) for short functions with one type parameter, but as soon as we get to more than one
why are we making our lives harder than they need to be. Your LSP supports renaming them! You're one code action away from just slightly improving the readability of your codebase.

Take this little snippet I yoinked from some code I wrote the other day.
```rust
fn validate_and_transform<T, U, V, W>(
    field_name: &str,
    map: &HashMap<String, serde_json::Value>,
    validator: U,
    transformer: V,
) -> Option<W>
where
    T: DeserializeOwned,
    U: Fn(&T) -> bool,
    V: Fn(T) -> W,
{
    map.get(&build_key_from_field(field_name))
        .cloned()
        .and_then(|v| serde_json::from_value(v).ok())
        .and_then(|v: T| validator(&v).then_some(v))
        .map(transformer)
}
```
Now lets make this nicer
```rust
fn validate_and_transform<Raw, Validator, Transformer, Result>(
    field_name: &str,
    map: &HashMap<String, serde_json::Value>,
    validator: Validator,
    transformer: Transformer,
) -> Option<Result>
where
    Raw: DeserializeOwned,
    Validator: Fn(&Raw) -> bool,
    Transformer: Fn(Raw) -> Result,
{
    map.get(&build_key_from_field(field_name))
        .cloned()
        .and_then(|v| serde_json::from_value(v).ok())
        .and_then(|v: Raw| validator(&v).then_some(v))
        .map(transformer)
}
```
isn't that so much better! We can take it one step further by adding in the type parameter to the serde call
```rust
fn validate_and_transform<Raw, Validator, Transformer, Result>(
    field_name: &str,
    map: &HashMap<String, serde_json::Value>,
    validator: Validator,
    transformer: Transformer,
) -> Option<Result>
where
    Raw: DeserializeOwned,
    Validator: Fn(&Raw) -> bool,
    Transformer: Fn(Raw) -> Result,
{
    map.get(&build_key_from_field(field_name))
        .cloned()
        .and_then(|v| serde_json::from_value::<Raw>(v).ok())
        .and_then(|v: Raw| validator(&v).then_some(v))
        .map(transformer)
}
```
I've found LLMs are equally culpable of this, so its still on you to make sure your code is readable.

People much smarter than me [example](https://github.com/tokio-rs/tokio/blob/d666068be7489a7ff49b3ac3f6b61ccee0839972/tokio-util/src/codec/framed_read.rs#L180) are equally
gullible of doing this, I think its just somewhere we can each make each others lives that little bit easier.

