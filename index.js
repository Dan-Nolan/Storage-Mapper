const fs = require('fs');
const solc = require('solc');
const ganache = require('ganache-core');
const ethers = require('ethers');

const provider = new ethers.providers.Web3Provider(ganache.provider());

const contractName = "Simple";
const fileName = `${contractName}.sol`;
const content = fs.readFileSync("./" + fileName).toString();

const input = {
  language: 'Solidity',
  sources: {
     [fileName]: { content }
  },
  settings: {
    outputSelection: {
      '*': {
        '*': ['storageLayout', 'evm.bytecode.object', 'abi']
      }
    }
  }
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const { evm: { bytecode: { object }}, abi, storageLayout } = output.contracts[fileName][contractName];

const { types, storage } = storageLayout;

console.log(storageLayout);

class StorageMap {
  constructor(contract, storageLayout) {
    this.contract = contract;
    this.storageLayout = storageLayout;
  }
  async getStorage(name, ...args) {
    const { provider } = this.contract;
    const { types, storage } = this.storageLayout;

    const entry = storage.find(x => x.label === name);
    if(!entry) {
      console.log(`Storage variable '${name}' not found!`);
    }

    const getStorageAt = async (loc) => {
      try {
        const value = await provider.getStorageAt(this.contract.address, loc);
        return value;
      }
      catch(ex) {
        // https://github.com/ethers-io/ethers.js/issues/1132
        // appears to have been fixed in hardhat but not in ganache-core yet
        return "0x";
      }
    }

    // slot: a string with the decimal value of the slot
    const { label, slot, type } = entry;
    const { encoding, value: typeValue } = types[type];
    const paddedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(slot), "32");
    if(encoding === "inplace") {
      const value = await getStorageAt(paddedSlot);
      return this.parseValue(value, type);
    }
    else if(encoding === "bytes") {
      // lookup bytes ->
      //   is less than 32 bytes -> return higher-order bytes
      //   is greater -> take the length, go to keccak256(p) and start pulling data
      //              -> next slot is keccak256(p) + 1, keccak256(p) + 2, etc...
      const initialValue = await getStorageAt(paddedSlot);
      const bytesLength = parseInt(initialValue.slice(-2), 16);
      const isShort = (initialValue.length === 66);
      let val;
      if(isShort) {
        val = initialValue.slice(0, bytesLength + 2);
      }
      else {
        val = "0x";
        const baseSlot = ethers.utils.keccak256(paddedSlot);
        for(let i = 0; i*64 < bytesLength; i++) {
          const currentSlot = ethers.BigNumber.from(baseSlot).add(i).toHexString();
          const storage = await getStorageAt(currentSlot);
          const remainder = bytesLength - (i*64);
          const end = (remainder > 64) ? 64 : (remainder - 1);
          val += storage.slice(2, end + 2);
        }
      }
      if(type === "t_string_storage") {
        return ethers.utils.toUtf8String(val);
      }
      else {
        return val;
      }
    }
    else if(encoding === "mapping") {
      const key = args[0];
      const paddedKey = ethers.utils.hexZeroPad(key, "32");
      const slot = ethers.utils.keccak256(paddedKey + paddedSlot.slice(2));
      const value = await getStorageAt(slot);
      return this.parseValue(value, typeValue);
    }
  }
  parseValue(value, type) {
    if(type === "t_bool") {
      return Boolean(parseInt(value));
    }
    else if(type === "t_uint256") {
      return parseInt(value);
    }
    else {
      return value;
    }
  }
}

async function test() {
  const signer = await provider.getSigner(0);
  const addr = await signer.getAddress();
  const Contract = new ethers.ContractFactory(abi, object, signer);
  const contract = await Contract.deploy();
  const storageMap = new StorageMap(contract, storageLayout);

  const x = await storageMap.getStorage('x');
  const y = await storageMap.getStorage('y');
  const z = await storageMap.getStorage('z');

  const isOn = await storageMap.getStorage('isOn');

  const balance = await storageMap.getStorage('balances', addr);
  const short = await storageMap.getStorage('short');
  const long = await storageMap.getStorage('long');

  console.log({ x, y, z, isOn, balance, short, long });
}

test()
  .then(() => process.exit(1))
  .catch((ex) => {
    console.log(ex);
    process.exit(1);
  });
