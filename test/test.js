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

  it('should handle structs', async () => {
    const structure = await storageMap.getStorage('structure');
    assert.equal(structure.num, 9);
    assert.equal(structure.yup, true);
  });

  it('should handle arrays', async () => {
    const first = await storageMap.getStorage('numbers', 0);
    const second = await storageMap.getStorage('numbers', 1);
    const third = await storageMap.getStorage('numbers', 2);
    assert.equal(first, 5);
    assert.equal(second, 10);
    assert.equal(third, 15);
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
