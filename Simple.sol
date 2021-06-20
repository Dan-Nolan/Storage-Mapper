//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Base {
  uint z = 3;
}

contract Simple is Base {
  uint x = 2;
  uint y = 1; // 0x1
  string testing = "happy times";

  mapping(address => uint) balances;

  constructor() {
    balances[msg.sender] = 1000;
  }
}
