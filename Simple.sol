//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Base {
  uint z = 52;
}

contract Simple is Base {
  mapping(address => uint) balances;

  uint x = 33;
  string short = "happy times";
  string long = "much longer times with a lot more storage space taken up wooohooo";

  uint y = 500;

  constructor() {
    balances[msg.sender] = 5243;
  }
}
