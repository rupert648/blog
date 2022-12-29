---
id: Hashmap Implementation
---
[Github](https://github.com/rupert648/hashmap-rs)

# About
Spent an afternoon implementing a hashmap from scratch in rust.
The hashmap is generic, meaning it can take as key any type which implements the `Hash` trait.

Features the main basic hashmap operations.
 * `HashMap<T, V>.get(key: T)`
 * `HashMap<T, V>.push(key: T, value: V)`
 * `HashMap<T, V>.delete(key: T)`
 * `HashMap<T, V>.clear()`

`HashMap` struct stores array of pointers to key value pairs. Array is fixed size of 256 (future feature would make this dynamic). Collisions are handled through standard linked list method.

<img src="/img/hashmapDataStructure.png" alt="drawing" width="400px" />

Built under TDD, using `rstest`.