---
id: JLox Parser and Interpreter 
---
[Github](https://github.com/rupert648/JLox)

**Technologies:** Java 

## About 
In an effort to better understand parsers and interpreters I undertook the task of implementing my own Interpreter, following the [Crafting Interpreters](https://craftinginterpreters.com/) book by Robert Nystrom.

Through this project I built an interpreter for the *Lox Programming language.* - a C-Syntax styled scripting language which features all regular operations, first class functions, and classes (no inheritance yet!). The project in question tokenises a given file (or a line in the REPL), parses it into an AST using a recursive descent parser approach, and then interprets the AST.

This means programs such as the following are valid and can be run by my interpreter.
```
fun fib(n) {
  if (n <= 1) return n;
  return fib(n - 2) + fib(n - 1);
}

for (var i = 0; i < 20; i = i + 1) {
  print fib(i);
} 
```

Through this project I gained a much stronger understanding of how an interpreter is able to translate a sequence of characters into a data structure, then use this data structure to execute some code.

By writing this program in Java we get to piggy back off of the JVM; allowing us to utilise the existing stack for things like recursion, and to skip some more technical implementations such as a garbage collector - focusing on the basics of writing a language from scratch.
