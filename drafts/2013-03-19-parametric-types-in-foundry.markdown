---
layout: post
title: "Parametric types in Foundry"
date: 2013-03-19 08:13
comments: true
categories:
  - software
  - ruby
  - foundry
---

In a [past article][l4ed], I have described my dream of an embedded developer's language. In this article, I will explain _parametric typing_, one of the two cornerstone features which give statically typed Foundry the flexibility of dynamically typed Ruby.

  [l4ed]: /blog/2012/12/06/a-language-for-embedded-developers/

<!--more-->

In a nutshell, the type system of Foundry features [polymorphism][], [subtyping][], and types depending both on [types][dep-types] and [values][dep-values]. If you are familiar with academic work in the field, the Foundry type system closely resembles, and is partly inspired by type system of [Typed Racket][].

  [polymorphism]: http://en.wikipedia.org/wiki/Polymorphism_(computer_science)
  [subtyping]:    http://en.wikipedia.org/wiki/Subtyping
  [dep-types]:    http://en.wikipedia.org/wiki/Type_operator
  [dep-values]:   http://en.wikipedia.org/wiki/Dependent_type_theory
  [typed racket]: http://docs.racket-lang.org/ts-guide/

Subtyping
---------

Subtyping is one of the more mainstream type system features. In Foundry, it works exactly the same as it does in Ruby; a class can inherit either a single distinct class or Object. [Diamond inheritance][] is not possible.

  [diamond inheritance]: http://en.wikipedia.org/wiki/Multiple_inheritance#The_diamond_problem

Additionally, Foundry enforces [Liskov substitution principle][lsp] in its type checker/inferencer and [ABI][]; that is, given a `class B` which inherits from `A`, everywhere a value of type `A` is expected, a value of type `B` can be passed.

  [lsp]: http://en.wikipedia.org/wiki/Liskov_substitution_principle
  [abi]: http://en.wikipedia.org/wiki/Application_binary_interface

Subtyping is one of the two ways to represent data polymorphism in Foundry (the other being typeclasses; more on that later). Let's look at an example.

``` ruby
class Sensor
  def report(IO io)
    raise NotImplementedError, "Reimplement Sensor#report in a subclass"
  end
end

class TemperatureSensor < Sensor
  def report(IO io)
    temp_celsium = Board.get_temperature_value
    io.puts "Temperature: #{temp_celsium} °C"
  end
end

class PressureSensor < Sensor
  def report(IO io)
    pressure_kpa = Board.get_pressure_value
    io.puts "Pressure: #{pressure_kpa} kPa"
  end
end

def main
  sensors     = [TemperatureSensor.new,
                 HumiditySensor.new]
  serial_port = Board::UART0

  sensors.each do |sensor|
    sensor.report serial_port
  end
end
```

foo
