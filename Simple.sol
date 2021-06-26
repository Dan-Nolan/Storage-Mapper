//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Base {
  uint z = 52;
}

contract Simple is Base {
  mapping(address => int) balances;

  uint[] numbers;

  address owner = msg.sender;

  uint x = 33;
  string short = "happy times";
  string long = "much longer times with a lot more storage space taken up wooohooo!";

  int8 neg = -128;
  int pos = 55;

  bool isOn = true;

  uint y = 500;

  constructor() {
    balances[msg.sender] = -555;

    numbers.push(5);
    numbers.push(10);
    numbers.push(15);
  }
}
