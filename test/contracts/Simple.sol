//SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.0;

contract Base {
  uint z = 52;
}

contract Simple is Base {
  mapping(address => int) balances;

  mapping(address => mapping(address => uint)) nestedBalances;

  uint[] numbers;

  struct Structure {
    uint[] numbers;
    uint num;
    string msg;
  }

  Structure structure;

  struct OffsetStruct {
    uint24 a;
    uint16 b;
    uint32 c;
    uint64 d;
    uint256 e;
    uint24 f;
    uint16 g;
    uint32 h;
    uint64 i;
  }

  OffsetStruct offsetStruct;

  Structure[] structures;

  mapping(uint => OffsetStruct[]) mapFun;

  bytes2 nibble = 0xbeef;
  bytes6 snacks = 0xabcdef123456;

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

    nestedBalances[msg.sender][msg.sender] = 750;

    structure.num = 9;
    structure.msg = "Hello World! This is a long message test, long enough for 2 slots";
    structure.numbers.push(52);

    Structure storage s0 = structures.push();
    s0.num = 47;
    s0.msg = "Weee";

    Structure storage s1 = structures.push();
    s1.num = 49;
    s1.msg = "Wooo";

    offsetStruct.a = 20;
    offsetStruct.b = 40;
    offsetStruct.c = 60;
    offsetStruct.d = 80;
    offsetStruct.e = 125;
    offsetStruct.f = 5;
    offsetStruct.g = 15;
    offsetStruct.h = 25;
    offsetStruct.i = 35;

    OffsetStruct storage s2 = mapFun[0].push();
    s2.e = 77;
    s2.f = 99;

    OffsetStruct storage s3 = mapFun[0].push();
    s3.a = 11;
    s3.b = 12;

    OffsetStruct storage s4 = mapFun[1].push();
    s4.c = 55;
    s4.d = 44;

    OffsetStruct storage s5 = mapFun[1].push();
    s5.g = 33;
    s5.h = 22;

    numbers.push(5);
    numbers.push(10);
    numbers.push(15);
  }
}
