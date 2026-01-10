+++
title = "Implementing a HashMap in Rust"
date = "2023-01-04"

[taxonomies]
tags = ["Rust", "Data Structures", "Programming", "Tutorial"]

[extra]
repo_view = true
comment = true
+++

In this tutorial, we're going to help you build your very own HashMap in Rust. We'll be explaining each step along the way, so don't worry if you're new to the language. However, some basic knowledge of Rust is expected for this tutorial — we won't be covering concepts like mutable references or Rust syntax in detail.

If you want to skip past the tutorial and step-by-step explanations, feel free to jump straight to the project on GitHub. This project also includes some unit tests which, for brevity's sake, I have skipped past adding in this tutorial.

# Understanding Hashmaps

Let's begin with arrays, and why they're great. An array is a collection of data stored in sequential order. Each data element in the array is assigned a numerical index, which can be used to access and retrieve the element.

For example, if we want to retrieve a specific piece of data from an array and we know its index, we can easily use that index to access the element at that position in the array. The array provides a starting point or "pointer" for the series of data, and the index tells us how far to move from that starting point to access the desired element.

One limitation of using arrays to store data is that we must know the index of the element to access it. This can be inconvenient if we only know the value of the element itself or if we want to use a different type of information, such as a key, to access the element.

In these cases, a hashmap can be a more suitable data structure. A hashmap is a collection of data that is stored and accessed using keys rather than indices. This allows us to retrieve elements based on their associated key rather than their position in the collection.

For example, we could use a person's name as a key to access their phone number in a hashmap. Hashmaps offer more flexibility and power when it comes to storing and accessing data compared to arrays.

## How Does It Work?

At their underlying structure, a hashmap is, in essence, an array. However, we are now changing the method of accessing that array. This is where a hash function comes in. A hash function takes a key as input and returns some integer which we can use as an index into that underlying array.

A simple hash function for converting a string into an integer may look as follows in rust:

```rust
fn simple_hash(string: &str) -> u32 {
    let mut total = 0;
    for c in string.chars() {
        total += c as u32;
    }
    total
}
```

Once we have the integer value returned by the hash function, we can use the modulus operator to reduce it to a value within the bounds of the array. For example:

```rust
let index = simple_hash("hello") % array_size;
```

This would give us an index within the bounds of the array, allowing us to access the element at that index using the key "hello".

## Properties of a "Perfect" Hash Function

A "perfect" or "ideal" hash function would have the following properties:

* It should be deterministic, meaning that it always produces the same output for a given input
* It should distribute keys uniformly across the range of possible output values so that keys are evenly distributed among the indices in the underlying array
* It should produce a unique output value for every possible key so that there are no collisions
* It should be fast to compute so that it does not significantly impact the performance of the hashmap
* It should be resistant to collision attacks, meaning that it should be difficult for an attacker to craft keys that will produce collisions

Keep in mind that it is generally impossible to achieve all of these properties at the same time, especially when dealing with large sets of keys. Therefore, most hash functions aim to balance these properties and trade off some degree of performance or security to achieve a reasonable level of effectiveness.

# Handling Collisions

The truth is, collisions are inevitable when working with hashmaps. Either the hash function produces the same index for two values, or the underlying array is smaller than the number of values it holds. Either way at some point two or more keys may be pointing at the same location in memory, and we want to avoid any unwritten data.

A common solution to this, and the solution we will be using, is to create a linked list at each index in the array when a collision occurs. Then, when searching for a key/value, we traverse this linked list until we find our key.

# Implementing the HashMap

For our tutorial, we are going to be implementing the four most basic operations of a hashmap:

* `HashMap<T, V>.get(key: T)`
* `HashMap<T, V>.push(key: T, value: V)`
* `HashMap<T, V>.delete(key: T)`
* `HashMap<T, V>.clear()`

Note that we can see type annotations here, which allows our implementation to be fully generic and accept any type (with some caveats) for our key and value pair.

[Content continues with all code blocks preserved...]

# Conclusion

Congrats on making it through this tutorial on implementing a hashmap in Rust! By now, you should have a good understanding of how hashmaps work and how to implement one from scratch. You should also be familiar with one possible implementation of the various methods that a hashmap provides, such as put, get, and remove.

I hope that you found this tutorial helpful and that it has given you the confidence to implement a hashMap in your own Rust projects. Feel free to play around with the code and try out different configurations and methods to get a better understanding of how it all works.

You can also check out the fully completed code for this tutorial on the GitHub repository here, complete with a few unit tests for the code.

Thanks for reading, and happy coding!
