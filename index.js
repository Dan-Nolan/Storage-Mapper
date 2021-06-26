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
      console.log(`Storage variable '${name}' not found!`)
    }

    const getStorageAt = (loc) => provider.getStorageAt(this.contract.address, loc);

    // slot: a string with the decimal value of the slot
    const { label, slot, type } = entry;
    const { encoding } = types[type];
    const paddedSlot = ethers.utils.hexZeroPad(ethers.BigNumber.from(slot), "32");
    if(encoding === "inplace") {
      return getStorageAt(paddedSlot);
    }
    else if(encoding === "bytes") {
      // lookup bytes ->
      //   is less than 32 bytes -> return higher-order bytes
      //   is greater -> take the length, go to keccak256(p) and start pulling data
      //              -> next slot is keccak256(p) + 1, keccak256(p) + 2, etc...
      const initialValue = await getStorageAt(paddedSlot);
      const bytesLength = parseInt(initialValue.slice(-2), 16);
      const isShort = (initialValue.length === 66);
      if(isShort) {
        const val = initialValue.slice(0, bytesLength + 2);
        return val;
      }
      else {
        let allStorage = "0x";
        const baseSlot = ethers.utils.keccak256(paddedSlot);
        for(let i = 0; i*64 < bytesLength; i++) {
          const currentSlot = ethers.BigNumber.from(baseSlot).add(i).toHexString();
          const storage = await getStorageAt(currentSlot);
          const remainder = bytesLength - (i*64);
          const end = (remainder > 64) ? 64 : (remainder - 1);
          allStorage += storage.slice(2, end + 2);
        }
        return allStorage;
      }
    }
    else if(encoding === "mapping") {
      const key = args[0];
      const paddedKey = ethers.utils.hexZeroPad(key, "32");
      const slot = ethers.utils.keccak256(paddedKey + paddedSlot.slice(2));
      return getStorageAt(slot);
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

  const balance = await storageMap.getStorage('balances', addr);
  const short = await storageMap.getStorage('short');
  const long = await storageMap.getStorage('long');

  console.log({
    x: parseInt(x),
    y: parseInt(y),
    z: parseInt(z),
    balance: parseInt(balance),
    short: ethers.utils.toUtf8String(short),
    long: ethers.utils.toUtf8String(long),
  });
}

test()
  .then(() => process.exit(1))
  .catch((ex) => {
    console.log(ex);
    process.exit(1);
  });
