const {assert} = require('chai');
const ganache = require('ganache-core');
const ethers = require('ethers');
const compile = require('./helpers/compile');
const StorageMap = require('../src/StorageMap');

describe('StorageMap', function() {
  let storageMap;
  let addr;
  before(async () => {
    const { abi, bytecode, storageLayout } = compile("Simple", "Simple.sol");
    const { types, storage } = storageLayout;

    const provider = new ethers.providers.Web3Provider(ganache.provider());

    const signer = await provider.getSigner(0);
    addr = await signer.getAddress();
    const Contract = new ethers.ContractFactory(abi, bytecode, signer);
    const contract = await Contract.deploy();
    storageMap = new StorageMap(contract, storageLayout);
  });

  it('should handle uints', async () => {
    const x = await storageMap.getStorage('x');
    const y = await storageMap.getStorage('y');
    const z = await storageMap.getStorage('z');
    assert.equal(x, 33);
    assert.equal(y, 500);
    assert.equal(z, 52);
  });

  it('should handle addresses', async () => {
    const owner = await storageMap.getStorage('owner');
    assert.equal(owner.toLowerCase(), addr.toLowerCase());
  });

  it('should handle bools', async () => {
    const isOn = await storageMap.getStorage('isOn');
    assert.equal(isOn, true);
  });

  it('should handle strings (long and short)', async () => {
    const short = await storageMap.getStorage('short');
    const long = await storageMap.getStorage('long');
    assert.equal(short, "happy times");
    assert.equal(long, "much longer times with a lot more storage space taken up wooohooo!");
  });

  it('should handle ints (negative and positive)', async () => {
    const neg = await storageMap.getStorage('neg');
    const pos = await storageMap.getStorage('pos');
    assert.equal(neg, -128);
    assert.equal(pos, 55);
  });

  it("should handle fixed byte arrays", async () => {
    const nibble = await storageMap.getStorage("nibble");
    assert.equal(nibble, "0xbeef");
    const snacks = await storageMap.getStorage("snacks");
    assert.equal(snacks, "0xabcdef123456");
  });

  it('should handle structs', async () => {
    const structure = await storageMap.getStorage('structure');
    assert.equal(structure.num, 9);
    assert.equal(structure.msg, "Hello World! This is a long message test, long enough for 2 slots");
    const numberInStruct = await storageMap.getStorage("structure", "numbers", 0);
    assert.equal(numberInStruct, 52);
  });

  it('should handle offset structs', async () => {
    const structure = await storageMap.getStorage('offsetStruct');
    assert.equal(structure.a, 20);
    assert.equal(structure.b, 40);
    assert.equal(structure.c, 60);
    assert.equal(structure.d, 80);
    assert.equal(structure.e, 125);
    assert.equal(structure.f, 5);
    assert.equal(structure.g, 15);
    assert.equal(structure.h, 25);
    assert.equal(structure.i, 35);
  });

  it("should handle a mapping to an array of structs", async () => {
    assert.equal(await storageMap.getStorage('mapFun', 0, 0, 'e'), 77);
    assert.equal(await storageMap.getStorage('mapFun', 0, 0, 'f'), 99);
    assert.equal(await storageMap.getStorage('mapFun', 0, 1, 'a'), 11);
    assert.equal(await storageMap.getStorage('mapFun', 0, 1, 'b'), 12);
    assert.equal(await storageMap.getStorage('mapFun', 1, 0, 'c'), 55);
    assert.equal(await storageMap.getStorage('mapFun', 1, 0, 'd'), 44);
    assert.equal(await storageMap.getStorage('mapFun', 1, 1, 'g'), 33);
    assert.equal(await storageMap.getStorage('mapFun', 1, 1, 'h'), 22);
  });

  it('should handle offset structs explicitly', async () => {
    const structureA = await storageMap.getStorage('offsetStruct', 'a');
    assert.equal(structureA, 20);

    const structureC = await storageMap.getStorage('offsetStruct', 'c');
    assert.equal(structureC, 60);
  });

  it('should handle arrays', async () => {
    const first = await storageMap.getStorage('numbers', 0);
    const second = await storageMap.getStorage('numbers', 1);
    const third = await storageMap.getStorage('numbers', 2);
    assert.equal(first, 5);
    assert.equal(second, 10);
    assert.equal(third, 15);
  });

  it('should handle arrays of structs', async () => {
    const first = await storageMap.getStorage('structures', 0);
    assert.equal(first.num, 47);
    assert.equal(first.msg, "Weee");

    const second = await storageMap.getStorage('structures', 1);
    assert.equal(second.num, 49);
    assert.equal(second.msg, "Wooo");
  });

  it('should handle mappings', async () => {
    const balance = await storageMap.getStorage('balances', addr);
    assert.equal(balance, -555);
  });

  it('should handle nested mappings', async () => {
    const nestedBalance = await storageMap.getStorage('nestedBalances', addr, addr);
    assert.equal(nestedBalance, 750);
  });
});
